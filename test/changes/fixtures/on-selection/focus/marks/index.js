
import assert from 'assert'
import { Mark } from '../../../../../..'

export default function (state) {
  const { startText, selection } = state
  const sel = selection.merge({
    isFocused: true,
    marks: Mark.createSet([
        Mark.create({
            type: 'bold'
        })
    ])
  })

  const next = state
    .change()
    .addMark('bold')
    .focus()
    .state

  assert.deepEqual(
    next.selection.toJS(),
    sel.toJS()
  )
}
