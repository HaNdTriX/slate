
import Schema from '../models/schema'
import Text from '../models/text'
import { List } from 'immutable'

/**
 * Options object with normalize set to `false`.
 *
 * @type {Object}
 */

const OPTS = { normalize: false }

/**
 * Define the core schema rules, order-sensitive.
 *
 * @type {Array}
 */

const rules = [

  /**
   * Only allow block nodes in documents.
   *
   * @type {Object}
   */

  {
    match: (node) => {
      return node.kind == 'document'
    },
    validate: (document) => {
      const invalids = document.nodes.filter(n => n.kind != 'block')
      return invalids.size ? invalids : null
    },
    normalize: (change, document, invalids) => {
      invalids.forEach((node) => {
        change.removeNodeByKey(node.key, OPTS)
      })
    }
  },

  /**
   * Only allow block nodes or inline and text nodes in blocks.
   *
   * @type {Object}
   */

  {
    match: (node) => {
      return node.kind == 'block'
    },
    validate: (block) => {
      const first = block.nodes.first()
      if (!first) return null

      const kinds = first.kind == 'block'
        ? ['block']
        : ['inline', 'text']

      const invalids = block.nodes.filter(n => !kinds.includes(n.kind))
      return invalids.size ? invalids : null
    },
    normalize: (change, block, invalids) => {
      invalids.forEach((node) => {
        change.removeNodeByKey(node.key, OPTS)
      })
    }
  },

  /**
   * Only allow inline and text nodes in inlines.
   *
   * @type {Object}
   */

  {
    match: (object) => {
      return object.kind == 'inline'
    },
    validate: (inline) => {
      const invalids = inline.nodes.filter(n => n.kind != 'inline' && n.kind != 'text')
      return invalids.size ? invalids : null
    },
    normalize: (change, inline, invalids) => {
      invalids.forEach((node) => {
        change.removeNodeByKey(node.key, OPTS)
      })
    }
  },

  /**
   * Ensure that block and inline nodes have at least one text child.
   *
   * @type {Object}
   */

  {
    match: (object) => {
      return object.kind == 'block' || object.kind == 'inline'
    },
    validate: (node) => {
      return node.nodes.size == 0
    },
    normalize: (change, node) => {
      const text = Text.create()
      change.insertNodeByKey(node.key, 0, text, OPTS)
    }
  },

  /**
   * Ensure that void nodes contain a text node with a single space of text.
   *
   * @type {Object}
   */

  {
    match: (object) => {
      return (
        (object.kind == 'inline' || object.kind == 'block') &&
        (object.isVoid)
      )
    },
    validate: (node) => {
      return node.text !== ' ' || node.nodes.size !== 1
    },
    normalize: (change, node, result) => {
      const text = Text.create(' ')
      const index = node.nodes.size

      change.insertNodeByKey(node.key, index, text, OPTS)

      node.nodes.forEach((child) => {
        change.removeNodeByKey(child.key, OPTS)
      })
    }
  },

  /**
   * Ensure that inline nodes are never empty.
   *
   * This rule is applied to all blocks, because when they contain an empty
   * inline, we need to remove the inline from that parent block. If `validate`
   * was to be memoized, it should be against the parent node, not the inline
   * themselves.
   *
   * @type {Object}
   */

  {
    match: (object) => {
      return object.kind == 'block'
    },
    validate: (block) => {
      const invalids = block.nodes.filter(n => n.kind == 'inline' && n.text == '')
      return invalids.size ? invalids : null
    },
    normalize: (change, block, invalids) => {
      // If all of the block's nodes are invalid, insert an empty text node so
      // that the selection will be preserved when they are all removed.
      if (block.nodes.size == invalids.size) {
        const text = Text.create()
        change.insertNodeByKey(block.key, 1, text, OPTS)
      }

      invalids.forEach((node) => {
        change.removeNodeByKey(node.key, OPTS)
      })
    }
  },

  /**
   * Ensure that inline void nodes are surrounded by text nodes, by adding extra
   * blank text nodes if necessary.
   *
   * @type {Object}
   */

  {
    match: (object) => {
      return object.kind == 'block' || object.kind == 'inline'
    },
    validate: (node) => {
      const invalids = node.nodes.reduce((list, child, index) => {
        if (child.kind !== 'inline') return list

        const prev = index > 0 ? node.nodes.get(index - 1) : null
        const next = node.nodes.get(index + 1)
        // We don't test if "prev" is inline, since it has already been processed in the loop
        const insertBefore = !prev
        const insertAfter = !next || (next.kind == 'inline')

        if (insertAfter || insertBefore) {
          list = list.push({ insertAfter, insertBefore, index })
        }

        return list
      }, new List())

      return invalids.size ? invalids : null
    },
    normalize: (change, block, invalids) => {
      // Shift for every text node inserted previously.
      let shift = 0

      invalids.forEach(({ index, insertAfter, insertBefore }) => {
        if (insertBefore) {
          change.insertNodeByKey(block.key, shift + index, Text.create(), OPTS)
          shift++
        }

        if (insertAfter) {
          change.insertNodeByKey(block.key, shift + index + 1, Text.create(), OPTS)
          shift++
        }
      })
    }
  },

  /**
   * Merge adjacent text nodes.
   *
   * @type {Object}
   */

  {
    match: (object) => {
      return object.kind == 'block' || object.kind == 'inline'
    },
    validate: (node) => {
      const invalids = node.nodes
        .map((child, i) => {
          const next = node.nodes.get(i + 1)
          if (child.kind != 'text') return
          if (!next || next.kind != 'text') return
          return next
        })
        .filter(Boolean)

      return invalids.size ? invalids : null
    },
    normalize: (change, node, invalids) => {
      // Reverse the list to handle consecutive merges, since the earlier nodes
      // will always exist after each merge.
      invalids.reverse().forEach(n => change.mergeNodeByKey(n.key, OPTS))
    }
  },

  /**
   * Prevent extra empty text nodes, except when adjacent to inline void nodes.
   *
   * @type {Object}
   */

  {
    match: (object) => {
      return object.kind == 'block' || object.kind == 'inline'
    },
    validate: (node) => {
      const { nodes } = node
      if (nodes.size <= 1) return

      const invalids = nodes.filter((desc, i) => {
        if (desc.kind != 'text') return
        if (desc.text.length > 0) return

        const prev = i > 0 ? nodes.get(i - 1) : null
        const next = nodes.get(i + 1)

        // If it's the first node, and the next is a void, preserve it.
        if (!prev && next.kind == 'inline') return

        // It it's the last node, and the previous is an inline, preserve it.
        if (!next && prev.kind == 'inline') return

        // If it's surrounded by inlines, preserve it.
        if (next && prev && next.kind == 'inline' && prev.kind == 'inline') return

        // Otherwise, remove it.
        return true
      })

      return invalids.size ? invalids : null
    },
    normalize: (change, node, invalids) => {
      invalids.forEach((text) => {
        change.removeNodeByKey(text.key, OPTS)
      })
    }
  }

]

/**
 * Create the core schema.
 *
 * @type {Schema}
 */

const SCHEMA = Schema.create({ rules })

/**
 * Export.
 *
 * @type {Schema}
 */

export default SCHEMA
