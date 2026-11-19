import EventKit
import Foundation

// nexday-eventkit: a tiny bridge between Nexday and the Mac's Calendar database.
// Every command prints one JSON document on stdout. Usage:
//   nexday-eventkit status
//   nexday-eventkit request
//   nexday-eventkit calendars
//   nexday-eventkit events <startEpochSeconds> <endEpochSeconds>
//   nexday-eventkit create <json>
//   nexday-eventkit delete <eventIdentifier>

let store = EKEventStore()

func out(_ value: Any) {
    guard JSONSerialization.isValidJSONObject(value),
          let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
          let text = String(data: data, encoding: .utf8) else {
        print("{\"error\":\"encode\"}")
        exit(1)
    }
    print(text)
}

func fail(_ message: String) -> Never {
    out(["error": message])
    exit(1)
}

func statusName() -> String {
    switch EKEventStore.authorizationStatus(for: .event) {
    case .notDetermined: return "notDetermined"
    case .restricted: return "restricted"
    case .denied: return "denied"
    case .authorized, .fullAccess: return "authorized"
    case .writeOnly: return "writeOnly"
    @unknown default: return "unknown"
    }
}

func hex(_ color: CGColor?) -> String {
    guard let color = color,
          let rgb = color.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil),
          let c = rgb.components, c.count >= 3 else { return "#5B6578" }
    func b(_ v: CGFloat) -> Int { max(0, min(255, Int((v * 255).rounded()))) }
    return String(format: "#%02X%02X%02X", b(c[0]), b(c[1]), b(c[2]))
}

func requestAccess() {
    let sem = DispatchSemaphore(value: 0)
    if #available(macOS 14.0, *) {
        store.requestFullAccessToEvents { _, _ in sem.signal() }
    } else {
        store.requestAccess(to: .event) { _, _ in sem.signal() }
    }
    // The permission sheet can stay up for a while; give the person a full minute.
    _ = sem.wait(timeout: .now() + 60)
}

/** The subset of RRULE Nexday writes: FREQ=DAILY/WEEKLY/MONTHLY, INTERVAL and BYDAY. */
func recurrenceRule(from text: String) -> EKRecurrenceRule? {
    var parts: [String: String] = [:]
    for bit in text.split(separator: ";") {
        let kv = bit.split(separator: "=", maxSplits: 1)
        if kv.count == 2 { parts[String(kv[0]).uppercased()] = String(kv[1]) }
    }
    guard let freq = parts["FREQ"] else { return nil }
    let interval = max(1, Int(parts["INTERVAL"] ?? "1") ?? 1)
    let codes: [String: EKWeekday] = [
        "MO": .monday, "TU": .tuesday, "WE": .wednesday, "TH": .thursday,
        "FR": .friday, "SA": .saturday, "SU": .sunday
    ]
    let days = (parts["BYDAY"] ?? "")
        .split(separator: ",")
        .compactMap { codes[String($0)] }
        .map { EKRecurrenceDayOfWeek($0) }
    let frequency: EKRecurrenceFrequency
    switch freq {
    case "DAILY": frequency = .daily
    case "WEEKLY": frequency = .weekly
    case "MONTHLY": frequency = .monthly
    default: return nil
    }
    return EKRecurrenceRule(
        recurrenceWith: frequency,
        interval: interval,
        daysOfTheWeek: frequency == .weekly && !days.isEmpty ? days : nil,
        daysOfTheMonth: nil,
        monthsOfTheYear: nil,
        weeksOfTheYear: nil,
        daysOfTheYear: nil,
        setPositions: nil,
        end: nil
    )
}

let args = CommandLine.arguments
guard args.count >= 2 else { fail("usage") }

switch args[1] {
case "status":
    out(["status": statusName()])

case "request":
    if statusName() == "notDetermined" { requestAccess() }
    out(["status": statusName()])

case "calendars":
    guard statusName() == "authorized" else { fail("notAuthorized") }
    let list = store.calendars(for: .event).map { cal -> [String: Any] in
        ["id": cal.calendarIdentifier, "title": cal.title, "color": hex(cal.cgColor), "source": cal.source.title]
    }
    out(list)

case "events":
    guard statusName() == "authorized" else { fail("notAuthorized") }
    guard args.count >= 4, let a = Double(args[2]), let b = Double(args[3]) else { fail("range") }
    let predicate = store.predicateForEvents(withStart: Date(timeIntervalSince1970: a), end: Date(timeIntervalSince1970: b), calendars: nil)
    let iso = ISO8601DateFormatter()
    let list = store.events(matching: predicate).sorted { $0.startDate < $1.startDate }.map { e -> [String: Any] in
        var item: [String: Any] = [
            "id": e.eventIdentifier ?? UUID().uuidString,
            "title": e.title ?? "Untitled",
            "start": iso.string(from: e.startDate),
            "end": iso.string(from: e.endDate),
            "allDay": e.isAllDay,
            "calendarId": e.calendar.calendarIdentifier,
            "calendar": e.calendar.title,
            "color": hex(e.calendar.cgColor)
        ]
        if let location = e.location, !location.isEmpty { item["location"] = location }
        if let url = e.url { item["url"] = url.absoluteString }
        // Declined events are flagged so the app can hide or fade them.
        if let me = e.attendees?.first(where: { $0.isCurrentUser }), me.participantStatus == .declined { item["declined"] = true }
        return item
    }
    out(list)

case "create":
    guard statusName() == "authorized" else { fail("notAuthorized") }
    guard args.count >= 3,
          let data = args[2].data(using: .utf8),
          let p = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
          let title = p["title"] as? String,
          let startMs = p["startMs"] as? Double,
          let endMs = p["endMs"] as? Double,
          let calendar = store.defaultCalendarForNewEvents else { fail("payload") }
    let event = EKEvent(eventStore: store)
    event.calendar = calendar
    event.title = title
    event.isAllDay = (p["allDay"] as? Bool) ?? false
    event.startDate = Date(timeIntervalSince1970: startMs / 1000)
    event.endDate = Date(timeIntervalSince1970: endMs / 1000)
    if let location = p["location"] as? String, !location.isEmpty { event.location = location }
    if let rrule = p["rrule"] as? String, !rrule.isEmpty, let rule = recurrenceRule(from: rrule) {
        event.recurrenceRules = [rule]
    }
    do {
        try store.save(event, span: .thisEvent, commit: true)
        out(["id": event.eventIdentifier ?? ""])
    } catch {
        fail("save")
    }

case "update":
    // Moves one (non-recurring) event: args are the event id and {"startMs":..., "endMs":...}.
    guard statusName() == "authorized" else { fail("notAuthorized") }
    guard args.count >= 4,
          let data = args[3].data(using: .utf8),
          let p = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
          let startMs = p["startMs"] as? Double,
          let endMs = p["endMs"] as? Double,
          endMs > startMs else { fail("payload") }
    guard let event = store.event(withIdentifier: args[2]) else { fail("notFound") }
    guard !event.hasRecurrenceRules else { fail("recurring") }
    event.startDate = Date(timeIntervalSince1970: startMs / 1000)
    event.endDate = Date(timeIntervalSince1970: endMs / 1000)
    do {
        try store.save(event, span: .thisEvent, commit: true)
        out(["ok": true])
    } catch {
        fail("save")
    }

case "delete":
    guard statusName() == "authorized" else { fail("notAuthorized") }
    guard args.count >= 3 else { fail("id") }
    guard let event = store.event(withIdentifier: args[2]) else { fail("notFound") }
    do {
        try store.remove(event, span: .futureEvents, commit: true)
        out(["ok": true])
    } catch {
        fail("remove")
    }

default:
    fail("unknown command")
}
