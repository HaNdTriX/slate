
import assert from 'assert'

export default function (state) {
  const { document, selection } = state
  const texts = document.getTexts()
  const second = texts.get(1)
  const fifth = texts.get(4)
  const range = selection.merge({
    anchorKey: second.key,
    anchorOffset: 2,
    focusKey: fifth.key,
    focusOffset: 2
  })

  const next = state
    .change()
    .select(range)
    .setInline({ type: 'code' })
    .state

  assert.deepEqual(
    next.selection.toJS(),
    range.toJS()
  )

  return next
}
