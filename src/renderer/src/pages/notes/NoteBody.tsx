import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import {
  mdToHtml,
  newRow,
  nodesToMd,
  parseLine,
  rowsFromText,
  stripMd,
  textFromRows,
  type NoteRow,
  type RowKind
} from '../../lib/noteText'

/**
 * The note's writing surface: one editable row per line. Headings are big, bullets and action items
 * are real, and **bold** / *italic* show as formatting. The note is still saved as plain text with
 * light markers (see lib/noteText.ts), so everything else that reads notes keeps working.
 */

export type FormatState = { bold: boolean; italic: boolean; kind: RowKind | null }

export type NoteBodyHandle = {
  focus: () => void
  /** Replaces the whole text (an outside change: AI, the side list, a template). */
  setText: (text: string) => void
  /** Turns the row the caret is in into this kind (again = back to a paragraph). */
  applyKind: (kind: RowKind) => void
  format: (cmd: 'bold' | 'italic') => void
}

const commands: Array<{ icon: IconName; label: string; hint: string; kind: RowKind | 'bold' | 'italic' }> = [
  { icon: 'checkSquare', label: 'Action item', hint: '[ ]', kind: 'todo' },
  { icon: 'list', label: 'Bulleted list', hint: '-', kind: 'bullet' },
  { icon: 'heading', label: 'Heading', hint: '#', kind: 'h' },
  { icon: 'bold' as IconName, label: 'Bold', hint: '⌘B', kind: 'bold' },
  { icon: 'italic' as IconName, label: 'Italic', hint: '⌘I', kind: 'italic' }
]

type Caret = 'start' | 'end' | number

function placeCaret(el: HTMLElement, at: Caret): void {
  const sel = window.getSelection()
  if (!sel) return
  const r = document.createRange()
  if (at === 'start' || at === 'end') {
    r.selectNodeContents(el)
    r.collapse(at === 'start')
  } else {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let n = at
    let node: Node | null
    let placed = false
    while ((node = walker.nextNode())) {
      const len = node.textContent?.length ?? 0
      if (n <= len) {
        r.setStart(node, n)
        r.collapse(true)
        placed = true
        break
      }
      n -= len
    }
    if (!placed) {
      r.selectNodeContents(el)
      r.collapse(false)
    }
  }
  sel.removeAllRanges()
  sel.addRange(r)
}

/** Text before and after the caret inside a row, as **markdown**. */
function splitAtCaret(el: HTMLElement): { before: string; after: string; collapsed: boolean } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return null
  const r = sel.getRangeAt(0)
  const pre = r.cloneRange()
  pre.selectNodeContents(el)
  pre.setEnd(r.startContainer, r.startOffset)
  const post = r.cloneRange()
  post.selectNodeContents(el)
  post.setStart(r.endContainer, r.endOffset)
  return { before: nodesToMd(pre.cloneContents()), after: nodesToMd(post.cloneContents()), collapsed: r.collapsed }
}

type RowProps = {
  row: NoteRow
  placeholder?: string
  setEl: (id: string, el: HTMLDivElement | null) => void
  onInput: (id: string) => void
  onKeyDown: (id: string, e: React.KeyboardEvent<HTMLDivElement>) => void
  onFocus: (id: string) => void
  onPaste: (id: string, e: React.ClipboardEvent<HTMLDivElement>) => void
  onToggle: (id: string) => void
}

const RowView = memo(function RowView({ row, placeholder, setEl, onInput, onKeyDown, onFocus, onPaste, onToggle }: RowProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  // The line is edited in place; its HTML is only rewritten when something outside changed it (rev).
  useLayoutEffect(() => {
    if (ref.current) ref.current.innerHTML = mdToHtml(row.md)
  }, [row.rev]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`nb-row ${row.kind} ${row.state}`}>
      {row.kind === 'todo' && (
        <button
          className={`nb-cb ${row.state}`}
          aria-label={row.state === 'open' ? 'Mark done' : 'Mark open'}
          disabled={row.state === 'sent'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onToggle(row.id)}
        >
          {row.state === 'done' && <Icon name="check" size={11} strokeWidth={3.2} />}
          {row.state === 'sent' && <Icon name="arrowRight" size={11} strokeWidth={2.6} />}
        </button>
      )}
      {row.kind === 'bullet' && <span className="nb-dot" />}
      <div
        ref={(el) => {
          ref.current = el
          setEl(row.id, el)
        }}
        className="nb-line"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-ph={placeholder}
        onInput={() => onInput(row.id)}
        onKeyDown={(e) => onKeyDown(row.id, e)}
        onFocus={() => onFocus(row.id)}
        onPaste={(e) => onPaste(row.id, e)}
      />
      {row.state === 'sent' && <span className="nb-tag">In plan</span>}
    </div>
  )
})

export const NoteBody = forwardRef<
  NoteBodyHandle,
  { value: string; onChange: (text: string) => void; placeholder?: string; compact?: boolean; onFormat?: (s: FormatState) => void }
>(function NoteBody({ value, onChange, placeholder, compact, onFormat }, ref) {
  const [rows, setRows] = useState<NoteRow[]>(() => rowsFromText(value))
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const els = useRef(new Map<string, HTMLDivElement>())
  const pending = useRef<{ id: string; at: Caret } | null>(null)
  const active = useRef<string | null>(null)
  const emitted = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onFormatRef = useRef(onFormat)
  onFormatRef.current = onFormat

  // Tell the toolbar what the caret is in (bold? italic? a heading?) so its buttons show it.
  const reportFormat = useCallback(() => {
    const id = active.current
    const el = id ? els.current.get(id) : null
    const a = window.getSelection()?.anchorNode
    if (!id || !el || !a || !el.contains(a)) return
    onFormatRef.current?.({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      kind: rowsRef.current.find((r) => r.id === id)?.kind ?? null
    })
  }, [])
  useEffect(() => {
    document.addEventListener('selectionchange', reportFormat)
    return () => document.removeEventListener('selectionchange', reportFormat)
  }, [reportFormat])
  const [menu, setMenu] = useState<{ id: string; query: string; index: number } | null>(null)
  const menuRef = useRef(menu)
  menuRef.current = menu

  const commit = useCallback((next: NoteRow[], focus?: { id: string; at: Caret }) => {
    if (focus) pending.current = focus
    rowsRef.current = next
    setRows(next)
    const text = textFromRows(next)
    if (text !== emitted.current) {
      emitted.current = text
      onChangeRef.current(text)
    }
  }, [])

  // Put the caret where an edit asked for it, once the rows are on screen.
  useLayoutEffect(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    const el = els.current.get(p.id)
    if (el) {
      el.focus()
      placeCaret(el, p.at)
    }
  })

  const setEl = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) els.current.set(id, el)
    else els.current.delete(id)
  }, [])

  const patchRow = (id: string, patch: Partial<NoteRow>, focus?: { id: string; at: Caret }): void =>
    commit(
      rowsRef.current.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      focus
    )

  const filtered = (query: string): typeof commands => commands.filter((c) => c.label.toLowerCase().includes(query))

  const applyCommand = (id: string, kind: RowKind | 'bold' | 'italic'): void => {
    const rev = (rowsRef.current.find((r) => r.id === id)?.rev ?? 0) + 1
    if (kind === 'bold' || kind === 'italic') {
      // Clear the "/bold" text, then switch the style on: what is typed next comes out bold / italic.
      patchRow(id, { md: '', rev }, { id, at: 'start' })
      setMenu(null)
      setTimeout(() => {
        document.execCommand('styleWithCSS', false, 'false')
        document.execCommand(kind)
        reportFormat()
      }, 0)
      return
    }
    patchRow(id, { kind, state: 'open', md: '', rev }, { id, at: 'start' })
    setMenu(null)
  }

  const onInput = useCallback(
    (id: string) => {
      const el = els.current.get(id)
      const row = rowsRef.current.find((r) => r.id === id)
      if (!el || !row) return
      const md = nodesToMd(el)
      const plain = el.textContent ?? ''
      // Typing the marker turns a paragraph into that kind: "# ", "- ", "[] ".
      if (row.kind === 'p') {
        const rest = (re: RegExp): string => md.replace(re, '')
        if (/^#{1,3}\s/.test(plain)) return patchRow(id, { kind: 'h', md: rest(/^#{1,3}\s/), rev: row.rev + 1 }, { id, at: 'start' })
        if (/^[-*•]\s/.test(plain)) return patchRow(id, { kind: 'bullet', md: rest(/^[-*•]\s/), rev: row.rev + 1 }, { id, at: 'start' })
        if (/^\[( |x|X)?\]\s/.test(plain))
          return patchRow(id, { kind: 'todo', state: 'open', md: rest(/^\[( |x|X)?\]\s/), rev: row.rev + 1 }, { id, at: 'start' })
      }
      const slash = plain.match(/^\/(\w*)$/)
      if (slash) setMenu({ id, query: slash[1].toLowerCase(), index: 0 })
      else if (menuRef.current?.id === id) setMenu(null)
      if (md !== row.md) patchRow(id, { md })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const onKeyDown = useCallback(
    (id: string, e: React.KeyboardEvent<HTMLDivElement>) => {
      const el = els.current.get(id)
      const list = rowsRef.current
      const i = list.findIndex((r) => r.id === id)
      const row = list[i]
      if (!el || !row || e.nativeEvent.isComposing) return
      const m = menuRef.current

      if (m && m.id === id) {
        const shown = filtered(m.query)
        if (shown.length > 0) {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const d = e.key === 'ArrowDown' ? 1 : -1
            setMenu({ ...m, index: (m.index + d + shown.length) % shown.length })
            return
          }
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            applyCommand(id, shown[m.index % shown.length].kind)
            return
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setMenu(null)
          return
        }
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B' || e.key === 'i' || e.key === 'I')) {
        e.preventDefault()
        document.execCommand('styleWithCSS', false, 'false')
        document.execCommand(e.key.toLowerCase() === 'b' ? 'bold' : 'italic')
        onInput(id)
        return
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        const sp = splitAtCaret(el)
        if (!sp) return
        // Enter on an empty list item or heading ends it.
        if (row.kind !== 'p' && row.md === '' && sp.before === '' && sp.after === '') {
          patchRow(id, { kind: 'p', rev: row.rev + 1 }, { id, at: 'start' })
          return
        }
        const kind: RowKind = row.kind === 'bullet' || row.kind === 'todo' ? row.kind : 'p'
        const created = newRow(kind, sp.after)
        const next = list.slice()
        next[i] = { ...row, md: sp.before, rev: row.rev + 1 }
        next.splice(i + 1, 0, created)
        commit(next, { id: created.id, at: 'start' })
        return
      }

      if (e.key === 'Backspace') {
        const sp = splitAtCaret(el)
        if (!sp || !sp.collapsed || sp.before !== '') return
        e.preventDefault()
        if (row.kind !== 'p') {
          patchRow(id, { kind: 'p', rev: row.rev + 1 }, { id, at: 'start' })
        } else if (i > 0) {
          const prev = list[i - 1]
          const joinAt = stripMd(prev.md).length
          const next = list.slice()
          next[i - 1] = { ...prev, md: prev.md + row.md, rev: prev.rev + 1 }
          next.splice(i, 1)
          commit(next, { id: prev.id, at: joinAt })
        }
        return
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const sp = splitAtCaret(el)
        if (!sp || !sp.collapsed) return
        if (e.key === 'ArrowUp' && sp.before === '' && i > 0) {
          e.preventDefault()
          pending.current = { id: list[i - 1].id, at: 'end' }
          setRows(list.slice())
        } else if (e.key === 'ArrowDown' && sp.after === '' && i < list.length - 1) {
          e.preventDefault()
          pending.current = { id: list[i + 1].id, at: 'start' }
          setRows(list.slice())
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const onPaste = useCallback(
    (id: string, e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain').replace(/\r/g, '')
      const lines = text.split('\n')
      document.execCommand('insertText', false, lines[0])
      if (lines.length > 1) {
        const el = els.current.get(id)
        const list = rowsRef.current
        const i = list.findIndex((r) => r.id === id)
        const sp = el ? splitAtCaret(el) : null
        const made = lines.slice(1).map((raw) => {
          const l = parseLine(raw)
          return l.kind === 'blank'
            ? newRow('p', '')
            : l.kind === 'todo'
              ? newRow('todo', l.text, l.state)
              : newRow(l.kind === 'h' ? 'h' : l.kind === 'bullet' ? 'bullet' : 'p', l.kind === 'p' ? raw : l.text)
        })
        if (sp) made[made.length - 1] = { ...made[made.length - 1], md: made[made.length - 1].md + sp.after }
        const next = list.slice()
        if (el && sp) next[i] = { ...next[i], md: sp.before, rev: next[i].rev + 1 }
        next.splice(i + 1, 0, ...made)
        commit(next, { id: made[made.length - 1].id, at: 'end' })
      } else {
        onInput(id)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const onToggle = useCallback(
    (id: string) => {
      const row = rowsRef.current.find((r) => r.id === id)
      if (!row || row.state === 'sent') return
      patchRow(id, { state: row.state === 'open' ? 'done' : 'open' })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        const first = rowsRef.current[0]
        if (first) {
          pending.current = { id: first.id, at: 'start' }
          setRows(rowsRef.current.slice())
        }
      },
      setText: (text) => {
        commit(rowsFromText(text))
      },
      applyKind: (kind) => {
        const id = active.current ?? rowsRef.current[rowsRef.current.length - 1]?.id
        const row = rowsRef.current.find((r) => r.id === id)
        if (!row) return
        const nextKind: RowKind = row.kind === kind ? 'p' : kind
        patchRow(row.id, { kind: nextKind, state: 'open', rev: row.rev }, { id: row.id, at: 'end' })
        setTimeout(reportFormat, 0)
      },
      format: (cmd) => {
        document.execCommand('styleWithCSS', false, 'false')
        document.execCommand(cmd)
        if (active.current) onInput(active.current)
        reportFormat()
      }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const onFocus = useCallback(
    (id: string) => {
      active.current = id
      setTimeout(reportFormat, 0)
    },
    [reportFormat]
  )

  const shown = menu ? filtered(menu.query) : []
  const menuAt = menu ? rows.findIndex((r) => r.id === menu.id) : -1

  return (
    <div className={`nb${compact ? ' compact' : ''}`}>
      {rows.map((r, i) => (
        <div key={r.id} className="nb-slot">
          <RowView
            row={r}
            placeholder={rows.length === 1 && i === 0 ? placeholder : undefined}
            setEl={setEl}
            onInput={onInput}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onPaste={onPaste}
            onToggle={onToggle}
          />
          {menu && menuAt === i && shown.length > 0 && (
            <div className="slash">
              <div style={{ fontSize: 12, color: 'var(--ink3)', padding: '8px 16px 4px' }}>Add to note</div>
              {shown.map((c, k) => (
                <div
                  className={k === menu.index % shown.length ? 'sm on' : 'sm'}
                  key={c.label}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applyCommand(menu.id, c.kind)
                  }}
                >
                  {c.kind === 'bold' ? (
                    <b style={{ width: 20, textAlign: 'center', fontSize: 15 }}>B</b>
                  ) : c.kind === 'italic' ? (
                    <i style={{ width: 20, textAlign: 'center', fontSize: 15, fontFamily: 'serif' }}>I</i>
                  ) : (
                    <Icon name={c.icon} strokeWidth={1.7} round />
                  )}
                  {c.label}
                  <span className="h">{c.hint}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
})

/** Heading / bold / italic / list / action-item buttons. They show what the caret is in. */
export function FormatButtons({
  api,
  state
}: {
  api: React.RefObject<NoteBodyHandle | null>
  state: FormatState
}): React.JSX.Element {
  const keep = (e: React.MouseEvent): void => e.preventDefault() // keep the caret in the note
  return (
    <>
      <button className={`tb${state.kind === 'h' ? ' on' : ''}`} aria-label="Heading" aria-pressed={state.kind === 'h'} title="Heading" onMouseDown={keep} onClick={() => api.current?.applyKind('h')}>
        <Icon name="heading" strokeWidth={1.7} round />
      </button>
      <button className={`tb${state.bold ? ' on' : ''}`} aria-label="Bold" aria-pressed={state.bold} title="Bold (⌘B): select text, or switch it on and type" onMouseDown={keep} onClick={() => api.current?.format('bold')} style={{ fontWeight: 700, fontSize: 15 }}>
        B
      </button>
      <button className={`tb${state.italic ? ' on' : ''}`} aria-label="Italic" aria-pressed={state.italic} title="Italic (⌘I): select text, or switch it on and type" onMouseDown={keep} onClick={() => api.current?.format('italic')} style={{ fontStyle: 'italic', fontSize: 15, fontFamily: 'serif' }}>
        I
      </button>
      <button className={`tb${state.kind === 'bullet' ? ' on' : ''}`} aria-label="Bulleted list" aria-pressed={state.kind === 'bullet'} title="Bulleted list" onMouseDown={keep} onClick={() => api.current?.applyKind('bullet')}>
        <Icon name="list" strokeWidth={1.7} round />
      </button>
      <button className={`tb${state.kind === 'todo' ? ' on' : ''}`} aria-label="Action item" aria-pressed={state.kind === 'todo'} title="Action item" onMouseDown={keep} onClick={() => api.current?.applyKind('todo')}>
        <Icon name="checkSquare" strokeWidth={1.7} round />
      </button>
    </>
  )
}
