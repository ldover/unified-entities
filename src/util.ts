// @ts-nocheck
import type { Node } from 'unist'
import { visitParents } from 'unist-util-visit-parents'
import { unified } from 'unified'
import RemarkStringify from 'remark-stringify'
import RemarkParse from 'remark-parse'

export function getThrottle() {
  let throttleTimer = null
  let lastArgs = null
  let lastContext = null

  /**
   * Returns a throttled version of the provided callback function.
   * The throttled function will execute the callback at most once per specified delay.
   *
   * Function property flush() can be used to make the last function call immediately.
   *
   * @param {Function} callback - The callback function to be throttled.
   * @param {number} delay - The delay in milliseconds between each execution of the callback.
   * @returns {Function} - The throttled function.
   */
  return function throttle(callback, delay) {
    throttle.flush = function flush() {
      // If there's a scheduled execution, cancel it and run the callback immediately
      if (throttleTimer) {
        clearTimeout(throttleTimer)
        throttleTimer = null

        if (lastArgs) {
          callback.apply(lastContext, lastArgs)
          lastArgs = null
          lastContext = null
        }
      }
    }

    return function (...args) {
      const context = this

      if (throttleTimer) {
        // Save the latest context and arguments to call later
        lastArgs = args
        lastContext = context
        return
      }

      callback.apply(context, args)
      lastArgs = null
      lastContext = null

      throttleTimer = setTimeout(() => {
        throttleTimer = null
        if (lastArgs) {
          callback.apply(lastContext, lastArgs)
          lastArgs = null
          lastContext = null
        }
      }, delay)
    }
  }
}

export function getDebounce() {
  let debounceTimer = null
  let lastArgs = null
  let lastContext = null

  /**
   * Returns a debounced version of the provided callback function.
   * The debounced function will delay the execution of the callback until after
   * the delay has elapsed since the last time it was invoked.
   *
   * Function property flush() can be used to execute the callback immediately.
   *
   * @param {Function} callback - The callback function to be debounced.
   * @param {number} delay - The delay in milliseconds before the callback is executed after the last invocation.
   * @returns {Function} - The debounced function.
   */
  return function debounce(callback, delay) {
    debounce.flush = function flush() {
      // If there's a scheduled execution, cancel it and run the callback immediately
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null

        callback.apply(lastContext, lastArgs)
        lastArgs = null
        lastContext = null
      }
    }

    debounce.clear = function clear() {
      // If there's a scheduled execution, cancel it
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
        lastArgs = null
        lastContext = null
      }
    }

    return function (...args) {
      const context = this

      // Save the latest context and arguments to call later
      lastArgs = args
      lastContext = context

      if (debounceTimer) {
        // Cancel the previous timer and schedule a new execution
        clearTimeout(debounceTimer)
      }

      debounceTimer = setTimeout(() => {
        callback.apply(context, args)
      }, delay)
    }
  }
}

export function notArchivedOrDeleted(entity) {
  return !entity.archived && !entity.deleted
}

type Modifier = 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'
const modifiers: Modifier[] = ['shiftKey', 'ctrlKey', 'altKey', 'metaKey']

export function onlyModifier(e: KeyboardEvent | MouseEvent, m1: Modifier, ...rest: Modifier[]): boolean {
  const wanted = Array.from(new Set<Modifier>([m1, ...rest]));
  return modifiers.every(m => (wanted.includes(m) ? !!e[m] : !e[m]));
}

export const noModifier = (e: KeyboardEvent | MouseEvent) => !modifiers.some((m) => e[m])

export const anyModifiers = (e: KeyboardEvent | MouseEvent) => modifiers.some((m) => e[m])
export function capitalize(text: string) {
  return text.substring(0, 1).toUpperCase() + text.substring(1)
}

interface Link {
  node: any
  context: any
}

const blockTypes = [
  'paragraph',
  'heading',
  'thematicBreak',
  'blockquote',
  'list',
  'table',
  'html',
  'code'
]

function isBlockContent(node: any) {
  return blockTypes.includes(node.type)
}

export function renderNodeToHtml(node: Node): string {
  // remark-html wants a root node
  const root: Node = { type: "root", children: [node] } as any;
  const file = processor.stringify(root); // but stringify runs on tree -> HTML
  const rendered = String(file);
  console.log({ rendered })
  return rendered
}

export const processor = unified()
  .use(RemarkParse, { commonmark: true, pedantic: true })
  .use(RemarkStringify, {
    bullet: '*',
    emphasis: '*',
    listItemIndent: '1',
    rule: '-',
    ruleSpaces: false
  })

export function getLinks(tree: any): Link[] {
  const links: Link[] = []

  visitParents(
    { ...tree, children: tree.children },
    'link',
    (node, ancestors) => {
      const closestBlockLevelAncestor = ancestors.reduceRight(
        (result, needle) => result ?? (isBlockContent(needle) ? needle : null),
        null
      )
      links.push({
        node,
        context: closestBlockLevelAncestor
      })
      return true
    }
  )
  return links
}

export function stringifyLink(node: any) {
  return processor
    .stringify({
      type: 'root',
      children: node.children
    })
    .trimEnd()
}


export const nameFromContentHeading = (content: string) => {
  const firstLine = content.split('\n')[0]
  if (firstLine) {
    const match = firstLine.match(/^#\s(.+)/)
    if (match) {
      return match[1]
    }
  }

  return null
}

/**
* Convert Unix timestamp in seconds to Date
* @param {number} ts
* @returns {Date}
*/
export function fromTimestamp(ts) {
  return new Date(ts * 1000)
}

/**
 * Unix timestamp in seconds.
 * @returns {number}
 */
export function timestamp() {
  return Math.floor(new Date().getTime() / 1000)
}