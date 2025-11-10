// @ts-nocheck
import * as uuid from 'uuid'
import { parseLinks, type EntityLink } from './index.js'


export type EntityKind = Self | Collection | Space | Note | Log | Image | Idea | Task | Issue | Highlight | 
                         AIChat | AIPrompt | AIResponse | Person | Song | Playlist


             
                         
export const KINDS = [
  'self',
  'note',
  'log',
  'idea',
  'task',
  'issue',
  'image',
  'concept',
  'session',
  'goal',
  'collection',
  'project',
  'space',
  'book',
  'highlight',
  'article',
  'person',
  'post',
  'comment',
  'equation',
  'video',
  'song',
  'playlist',
  'question',
  'review',
  'aichat',
  'aiprompt',
  'airesponse',
]

const KINDS_NO_CREATE = ['self', 'image']

export const completableKinds = [
  'task',
  'issue',
  'session',
  'project',
  'book',
  'article',
  'video',
  'question',
  'goal',
  'idea',
  'post',
  'comment'
]

export type CompletableEntity = Completable & Entity

export const isCompletable = (e: Entity): e is CompletableEntity => {
  return completableKinds.includes(e.kind)
}

export const isAIKind = (e: Entity): e is AIPrompt | AIChat | AIResponse => {
  return completableKinds.includes(e.kind)
}

export const creatableKinds = KINDS.filter(k => !KINDS_NO_CREATE.includes(k))

export const noConvert = new Set(['self', 'image', 'video'])

/**
 * Unix timestamp in seconds.
 * @returns {number}
 */
function timestamp() {
  return Math.floor(new Date().getTime() / 1000)
}

/**
 * Convert Unix timestamp in seconds to Date
 * @param {number} ts
 * @returns {Date}
 */
export function fromTimestamp(ts) {
  return new Date(ts * 1000)
}

function getSignedInUser() {
  return null
}

function setsAreTheSame(setA: Set<any>, setB: Set<any>) {
  // Check if sizes are different
  if (setA.size !== setB.size) return false;

  // Check if all elements in setA are in setB
  for (let item of setA) {
    if (!setB.has(item)) return false;
  }

  return true;
}

interface Listener {
  listener: Function
  instance?: any
}

interface EventEmitter {
  on: any
  off: any
  emit: any
  observedBy: any
  unobserve: (instance: any) => void
  eventListeners: { [event: string]: Listener[] }
}


export interface ParentRelation {
  id: string
  created_at: number | null
  updated_at: number | null
  properties: Record<string, any>
  target: Entity | null
}

export const specialNames: Record<string, string> = {
  aichat: 'AI chat',
  aiprompt: 'AI prompt',
  airesponse: 'AI response'
};

const drafts = new Set([
  'note',
  'log',
  'idea',
  'task',
  'issue',
  'concept',
  'collection',
  'review',
  'project',
  'space',
  'article',
  'equation',
  'question',
  'aiprompt',
  'post',
  'comment',
  'goal'
])

export const startsAsDraft = (kind: string) => drafts.has(kind)

export interface Entity extends EventEmitter {
  kind: string
  id: string
  context: EntityKind | null // Context of this form
  entities: EntityKind[]     // Active workspace without archived/deleted entities
  parents: ParentRelation[]
  name: string
  icon: string | null
  created_at: number
  created_by: Entity | null
  updated_at: number | null
  updated_by: Entity | null
  deleted: boolean
  deleted_at: number | null
  deleted_by: Entity | null
  archived: boolean
  archived_at: number | null
  draft: boolean
  properties: null | Record<string, any>  // Custom properties

  confirmDelete: boolean

  
  // Convenience props
  links: EntityLink[]
  backlinks: EntityLink[]
  
  aliveness: number           // relative aliveness score, between [0, 1]
  temporalAliveness: number   // absolute aliveness between [0, 1]
  relationalAliveness: number // absolute aliveness (unbounded)

  add: (...entities: EntityKind[]) => void
  insert: (index: number, ...entities: EntityKind[]) => void
  remove: (id: string) => void
  has: (id: string, deep?: boolean) => boolean
  setOrder: (entities: Entity[]) => void

  setAuthor: (field: 'created_by' | 'updated_by' | 'deleted_by', author: Entity | null) => void
  setContext: (context: Entity) => void
  getParent: (parentId: string) => ParentRelation | null
  getParents: () => Entity[]
  addParent: (parent: Entity, properties?: Record<string, any>) => void
  updateParent: (parent: Entity, properties?: Record<string, any>) => void
  removeParent: (parent: Entity) => void
  setName: (name: string) => void
  setProp: (key: string, value: unknown) => void
  getName: () => string
  update: () => void
  delete: () => void
  archive: () => void
  unarchive: () => void
  restore: () => void
  convert: (kind: string) => void
  markDraft: (draft: boolean) => void
  toJSON: () => any
}

const clone = (props?: Record<string, any>) => props ? JSON.parse(JSON.stringify(props)) : {}

const buildRelationFromEntity = (parent: Entity, props = {}): ParentRelation => {
  const now = timestamp()
  return {
    id: parent.id,
    created_at: now,
    updated_at: now,
    properties: props ? clone(props) : {},
    target: parent
  }
}

const normalizeParentRelations = (initial: any): ParentRelation[] => {
  if (typeof initial === 'object') {
    return Object.entries(initial).map(([id, value]: [string, any]) => ({
      id,
      created_at: initial.created_at || null,
      updated_at: initial.updated_at || null,
      properties: value && value.properties ? clone(value.properties) : {},
      target: null
    }))
  }

  return []
}

export interface Completable {
  completed: boolean
  completed_at: null | number
  markComplete: (completed: boolean) => void
}

interface Renderable {
  content: string
}

export type ContentEditableEntity = Entity & ContentEditable

export function isContentEditableEntity(e: Entity): e is ContentEditableEntity {
  return (e as ContentEditableEntity).content != undefined
}

export interface ContentEditable extends Renderable {
  setContent: (content: string) => void
}

interface Convertible {
  convert: (kind: string) => void
}

export interface BaseEntity
  extends Entity,
    ContentEditable,
    Convertible {

  readonly _entityIdSet: Set<Entity>
}

export interface Concept extends BaseEntity {
  kind: 'concept'
}

export interface Note extends BaseEntity {
  kind: 'note'
}

export interface Idea extends BaseEntity, Completable {
  kind: 'idea'
}

export interface Session extends BaseEntity, Completable {
  kind: 'session'
}

export interface Equation extends BaseEntity {
  kind: 'equation'
}

export interface Video extends BaseEntity, Completable {
  kind: 'video'

  src: string | null
}

export interface Song extends BaseEntity {
  kind: 'song'

  src: string | null
}

export interface Book extends BaseEntity, Completable {
  kind: 'book'
}

export interface Question extends BaseEntity, Completable {
  kind: 'question'
}

export interface Article extends BaseEntity, Completable {
  kind: 'article'
}

export interface Post extends BaseEntity, Completable {
  kind: 'post'
}

export interface Comment extends BaseEntity, Completable {
  kind: 'comment'
}

export interface Issue extends BaseEntity, Completable {
  kind: 'issue'
}

export interface Log extends BaseEntity {
  kind: 'log'
}

export interface Task extends BaseEntity, Completable {
  kind: 'task'
}

export interface Goal extends BaseEntity, Completable {
  kind: 'goal'
}

export interface Person extends BaseEntity {
  kind: 'person'
}

export interface Highlight extends BaseEntity {
  kind: 'highlight'
}

export interface Review extends BaseEntity {
  kind: 'review'
}

export interface Playlist extends BaseEntity {
  kind: 'playlist'
}

export interface AIChat extends BaseEntity {
  kind: 'aichat'
  model: string | null           // default model
  system: string | null          // system prompt
}

export interface AIPrompt extends BaseEntity {
  kind: 'aiprompt'
  model: string | null    // Optional model 
  system: string | null   // Optional system prompt
}

type AsyncIterableStream<T> = AsyncIterable<T> & ReadableStream<T>;

export interface AIResponse extends BaseEntity {
  kind: 'airesponse'
  model: string
  ok: boolean | null  // null means response is still processing
  
  // Convenience prop
  streaming: boolean

  setStream(stream: AsyncIterableStream<string>): Promise<void>
  cancelStream(): Promise<void>
}

export interface Image extends Entity {
  kind: 'image'
  src: string | null
  mime_type: string
  height: number
  width: number
}

export interface Self extends BaseEntity {
  kind: 'self'
}

export interface Collection extends BaseEntity {
  kind: 'collection'
}

export interface Space extends BaseEntity {
  kind: 'space'
}

export interface Project extends BaseEntity, Completable {
  kind: 'project'
}

export const defaultName = (e: EntityKind) => {
  return !e.name ? `Untitled ${specialNames[e.kind] || e.kind}` : e.name
}

function serializeEntity(entity: Entity) {
  let additionalProps = Object.fromEntries(
    Object.keys(getKindProps(entity.kind)).map((key) => [key, entity[key]])
  )

  const serialized: Record<string, any> = {
    id: entity.id,
    context: entity.context ? entity.context.id : null,
    name: entity.name,
    kind: entity.kind,
    created_at: entity.created_at,
    created_by: entity.created_by?.id || null,
    updated_at: entity.updated_at,
    updated_by: entity.updated_by?.id || null,
    deleted: entity.deleted,
    deleted_at: entity.deleted_at,
    deleted_by: entity.deleted_by?.id || null,
    archived: entity.archived,
    archived_at: entity.archived_at,
    props: entity.properties ? JSON.parse(JSON.stringify(entity.properties)) : null,
    draft: entity.draft,
    icon: entity.icon,
    entities: entity.entities.map((e) => e.id),
    parents: Object.fromEntries(
      entity.parents.map((relation) => [
        relation.id,
        {
          created_at: relation.created_at,
          updated_at: relation.updated_at,
          props: clone(relation.properties)
        }
      ])
    ),
    // Serialize props specific to each kind
    ...additionalProps
  }

  for (const key of Object.keys(serialized)) {
    if (serialized[key] === null) {
      delete serialized[key]
    }
  }

  return serialized
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

const contentEditable = () => ({
  setContent: function setContent(value) {
    if (value === this.content) return
    this.content = value

    // Parse links
    this.links = parseLinks(this)
    this.emit('update-links', this.links)

    this.update()
  },
})

const convertible = () => ({
  convert: function (kind: string) {
    convert(this, this.kind, kind)
    this.update()
    this.emit('convert', this)
  }
})

const completable = () => ({
  markComplete(completed: boolean) {
    this.completed = completed
    if (completed) {
      this.completed_at = timestamp()
    } else {
      this.completed_at = null
    }

    this.update()
    if (completed) {
      this.emit('marked-completed')
    } else {
      this.emit('marked-todo')
    }
  }
})

const withSource = () => ({
  setSrc(src: string | null) {
    if (this.src === src) return
    this.src = src
    this.update()
  }
})

// Increase the max number of listeners for prod to prevent false positives
const MAX_LISTENERS = import.meta.env.DEV ? 5 : 25

const baseEntityMethods = () => ({
  on(event: string, listener: Function, instance?: any) {
    if (!listener) {
      throw new Error('invalid listener')
    }
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = []
    }
    this.eventListeners[event].push({ listener, instance })
    let num = this.eventListeners[event].length
    if (num > MAX_LISTENERS) {
      console.warn(`Memory leak detected: ${num} listeners exceeds max listeners ${MAX_LISTENERS}.`, this)
    }
  },

  // Remove an event listener
  off(event: string, listener: Function) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(
        (eventListener) => eventListener.listener !== listener
      )
    }
  },

  // Emit an event, triggering all listeners registered for this event
  emit(event: string, ...args: any[]) {
    const listeners = this.eventListeners[event]
    if (listeners) {
      listeners.forEach((eventListener) => eventListener.listener(...args))
    }
  },

  // Check if the given instance is observing any event on this entity
  observedBy(instance: any): boolean {
    return Object.values(this.eventListeners).some((listeners) =>
      listeners.some((eventListener) => eventListener.instance === instance)
    )
  },

  unobserve(instance: any) {
    for (const [key, listeners] of Object.entries(this.eventListeners)) {
      this.eventListeners[key] = listeners.filter((l: Listener) => l.instance !== instance)
    }
  },

  setContext(context: Entity) {
    if (context.id == this.id) {
      throw new Error('Cannot be its own context')
    }
    this.context = context
    this.update()
  },

  setAuthor(field: 'created_by' | 'updated_by' | 'deleted_by', author: Entity | null) {
    this[field] = author
    this.update()
  },

  addParent(parent: Entity, properties = {}) {
    if (this.parents.find((relation) => relation.id === parent.id)) return
    
    this.parents.push(buildRelationFromEntity(parent, properties))
    this.update()
    this.emit('parent-add', parent)
  },

  updateParent(parent: Entity, properties = {}) {
    const existing = this.parents.find((relation) => relation.id === parent.id)
    existing.properties = properties
    existing.updated_at = timestamp()

    this.update()
    this.emit('parent-update', parent)
  },

  removeParent(parent: Entity) {
    const parentsBeforeRemoval = this.parents.length
    this.parents = this.parents.filter((p) => p.id !== parent.id)

    if (this.parents.length < parentsBeforeRemoval) {
      if (parent.has(this.id)) {
        // Remove this from parent.entities if contained
        parent.remove(this.id)
      }
      this.update()
      this.emit('parent-remove', parent.id)
    }
  },

  getParent(parentId: string) {
    return this.parents.find((parent) => parent.id == parentId) || null
  },

  getParents() {
    return this.parents.filter((parent) => parent.target).map(r => r.target)
  },

  add(...entities: EntityKind[]) {
    this.insert(this.entities.length, ...entities)
  },

  insert(index: number, ...entities: EntityKind[]) {
    /**
     *  Validates there's no cycle in the containment graph.
     *
     *  If this collection is reached again during the walk up the parents hierarchy, then
     *  we throw RecursiveContainmentError
     */
    const validateOne = (collection: Entity) => {
      if (collection === this) {
        throw new RecursiveContainmentError(collection, this)
      }

      const walkOne = (relation: ParentRelation) => {
        const parentEntity = relation.target
        if (!parentEntity) {
          return
        }

        if (parentEntity === collection) {
          throw new RecursiveContainmentError(collection, this)
        } else {
          parentEntity.parents.forEach(walkOne)
        }
      }

      this.parents.forEach(walkOne)
    }

    // Check for recursive containment: if parent is added to child
    entities
      .forEach((collection: EntityKind) => {
        validateOne(collection)
      })

    let updated = false
    for (const entity of entities.reverse()) {
      if (!this.has(entity.id)) {
        if (!entity.id) {
          throw new Error('invalid id: ' + entity.id)
        }
        (this.entities as EntityKind[]).splice(index, 0, entity)
        entity.addParent(this)
        this._entityIdSet.add(entity.id)
        updated = true
        // todo: emit one batch event when adding multiple entities
        this.emit('insert', entity, index)
      }
    }

    updated && this.update()
  },

  remove(id: string) {
    if (!this.has(id)) {
      throw new Error('Collection does not include entity id: ' + id)
    }

    const index = this.entities.findIndex((entity) => entity.id === id)

    if (index != -1) {
      // Remove child from entities, but don't remove parent relation
      const entity = this.entities.splice(index, 1)[0]
      this._entityIdSet.delete(id)
      this.update()
      this.emit('remove', entity)
    } else {
      console.warn('removed entity not found: ', { id })
    }
  },

  has(id: string, deep = false) {
    // Immediate check in the current collection
    if (this._entityIdSet.has(id)) {
      return true
    }

    if (deep) {
      for (const entity of this.entities) {
        // If it implements Collection interface
        if (entity.has) {
          const hasInChild = entity.has(id, true) // Recursive check in child collection
          if (hasInChild) {
            return true
          }
        }
      }
    }

    // Not found in current or any child collections
    return false
  },

  setOrder(entities: EntityKind[]): void {
    if (!setsAreTheSame(new Set(entities.map(e => e.id)), this._entityIdSet)) {
      throw new Error()
    }

    this.entities = entities
    this.update()
    this.emit('new-order', entities)
  },

  toJSON() {
    return serializeEntity(this)
  },

  setName(name: string) {
    if (typeof name !== 'string') {
      throw new Error('Invalid name: name should be string')
    }
    this.name = name
    this.emit('rename')
    this.update()
  },

  setProp(key: string, value: unknown) {
    if (value === undefined) {
      if (!this.properties || !(key in this.properties)) {
        return
      }
      delete this.properties[key]
      if (Object.keys(this.properties).length === 0) {
        this.properties = null
      }
      this.update()
      return
    }

    if (!this.properties) {
      this.properties = {}
    }

    if (this.properties[key] === value) {
      return
    }

    this.properties[key] = value
    this.update()
  },

  getName() {
    return this.name
  },

  update() {
    this.updated_at = timestamp()
    this.updated_by = getSignedInUser()
    this.emit('update')
  },

  delete() {
    this.deleted = true
    this.deleted_at = timestamp()
    this.deleted_by = getSignedInUser()
    this.emit('delete')

     // Remove from parents' entities array
     ;(this.parents as ParentRelation[]).forEach(parent => parent.target?.remove(this.id))
  },

  archive() {
    this.archived = true
    this.archived_at = timestamp()
    this.update()
    this.emit('archive')

    // Remove from parents' entities array
    ;(this.parents as ParentRelation[]).forEach(parent => parent.target?.remove(this.id))
  },

  unarchive() {
    this.archived = false
    this.archived_at = null
    this.update()
    this.emit('unarchive')

    // Restore to all the parents's entities array
    ;(this.parents as ParentRelation[]).forEach(parent => parent.target?.add(this))
  },

  restore() {
    this.deleted = false
    this.deleted_at = null
    this.deleted_by = null
    this.update()
    this.emit('restore')

    // Restore to all the parents's entities array
    ;(this.parents as ParentRelation[]).forEach(parent => parent.target?.add(this))
  },

  markDraft(draft: boolean) {
    this.draft = draft
    this.update()
    if (draft) {
      this.emit('mark-draft')
    } else {
      this.emit('complete-draft')
    }
  }
})

const defaultProps = () => ({...renderableProps()})
const defaultMethods = () => ({...base()})

const baseEntityProps = () => ({
  id: uuid.v4(),
  context: null,
  name: null,
  icon: null,
  created_at: timestamp(),
  created_by: getSignedInUser(), // TODO: use 'Self' id
  updated_at: null,
  updated_by: null,
  deleted: false,
  deleted_at: null,
  deleted_by: null,
  archived: false,
  archived_at: null,
  properties: null,
  draft: false,
  parents: [],
  links: [],
  backlinks: [],
  eventListeners: {},
  confirmDelete: false,
  entities: [],
})

const base = () => ({
  ...contentEditable(),
  ...convertible(),
})

const kindMethods = (() => {
  const methods: Record<string, any> = {
    airesponse: {
      ...base(),
      
      async setStream(stream: ReadableStream<string>) {
        this.reader = stream.getReader();
        try {
          this.streaming = true
          while (this.ok == null) {
            const { value, done } = await this.reader.read();
            if (done) break;
            this.content += value;
            try {
              this.emit('delta', value);
            } catch (err) {
              console.error(err)
            }
          }
        } catch (err) {
          console.error(err);
          this.content += '\n\nError: ' + (err as Error).message;
          this.ok = false;
        } finally {
          this.streaming = false
          if (this.ok == null) { // Successfully completed 
            this.ok = true;
          }

          const name = nameFromContentHeading(this.content)
          if (name) {
            this.setName(name)
          } else {
            this.update();
          }
        }
      },
    
      async cancelStream() {
        this.ok = false;
        const errMsg = '\n\nError: cancelled'
        this.content += errMsg;
        this.emit('delta', errMsg);

        if (this.reader) {
          // this actually tears down the underlying stream,
          // even though it’s locked by our reader.
          await this.reader.cancel();
        }
      },
    },
    log: {
      ...base(),
    },
    video: {
      ...withSource(),
    },
    song: {
      ...base(),
      ...withSource(),
    },
    image: {
      ...withSource(),
    },
  }

  completableKinds.forEach(kind => {
    const existing = methods[kind] ?? {}
    methods[kind] = {
      ...base(),
      ...completable(),
      ...existing,
    }
  })

  return methods
})()

const renderableProps = () => ({ content: '' })
const completableProps = () => ({ completed: false, completed_at: null })

const kindProps = (() => {
  const base: Record<string, () => object> = {
    aichat: () => ({
      ...renderableProps(),
      model: null,
      system: defaultSystemPrompt,
    }),
    aiprompt: () => ({
      ...renderableProps(),
      model: null,
      system: null,
    }),
    airesponse: () => ({
      ...renderableProps(),
      model: '',
      ok: null
    }),
    log: () => ({
      ...renderableProps(),
    }),
    video: () => ({
      src: null,
    }),
    song: () => ({
      ...renderableProps(),
      src: null,
    }),
    playlist: () => ({
      ...renderableProps(),
    }),
    image: () => ({
      src: null,
      height: 0,
      width: 0,
      mime_type: ''
    }),
    space: () => ({
      ...renderableProps(),
    }),
    self: () => ({
      ...renderableProps(),
    }),
  }

  completableKinds.forEach(kind => {
    const existing = base[kind]
    base[kind] = () => ({
      ...renderableProps(),
      ...(existing ? existing() : {}),
      ...completableProps()
    })
  })

  return base
})()


const kindSetup = {
  space: (space: Space) => {
    return {
      ...space,

      confirmDelete: true // Additional config
    }
  },
}


function getKindProps(kind: string): object {
  return kindProps[kind] ? kindProps[kind]() : defaultProps()
}

function getKindMethods(kind: string) {
  return kindMethods[kind] ? kindMethods[kind] : defaultMethods()
}

export function create<T>(props: any): EntityKind {
  const kind = props.kind

  if (!KINDS.includes(kind)) {
    throw new Error("Unsupported kind: " + kind)
  }

  const entity = {
    ...baseEntityProps(),
    ...baseEntityMethods(),
    ...getKindProps(kind) ,  // Default props; if none specified means usual defaults
    ...getKindMethods(kind), // Specific kind methods and base method overrides
    ...props,
    parents: normalizeParentRelations(props.parents),
    kind: kind,
    _entityIdSet: new Set(props.entities)
  }

  if (kindSetup[kind]) {
    return kindSetup[kind](entity)
  }

  return entity
}

export class RecursiveContainmentError extends Error {
  constructor(public source: Entity, public target: Entity) {
    super()
    this.name = 'RecursiveContainmentError'
  }

  format() {
    // todo: this error is not clear, and is not accurate when C is nested within itself
    return `Entities cannot recursively contain themselves: '${this.target.name || this.target.id}' is contained within '${this.source.name || this.source.id}'`
  }
}

function convert(entity: Entity, fromKind: string, toKind: string) {
  console.log('before convert', entity.toJSON())

  // Determine which properties to add or remove based on the entity kinds
  const fromProps = new Set(Object.keys(getKindProps(fromKind)))
  const toProps = new Set(Object.keys(getKindProps(toKind)))

  const toRemove = [...fromProps].filter((key) => !toProps.has(key))
  const toAdd = [...toProps].filter((key) => !fromProps.has(key))

  toRemove.forEach((key) => delete entity[key])
  toAdd.forEach((key) => (entity[key] = getKindProps(toKind)[key]))

  // Change the kind property
  entity.kind = toKind

  // Remove old kind methods and bind new kind methods to the entity
  Object.keys(getKindMethods(fromKind)).forEach((method) => delete entity[method])
  Object.keys(getKindMethods(toKind)).forEach(
    (method) => (entity[method] = getKindMethods(toKind)[method].bind(entity))
  )

  // Also recreate overridden base entity methods if any
  // For example log overrides `setName` base method
  // TODO: maybe base entity overrides should not be possible: all entities should behave the same way;
  //   the reason we have the override for log is the ad-hoc fix — required log name doesn't make sense for our use case as Date is enough to identify the log
  //   but then other entities should have optional name as well
  const fromMethods = new Set(Object.keys(getKindMethods(fromKind)))
  const baseMethods = new Set(Object.keys(baseEntityMethods()))
  const methodsToApply = [...fromMethods].filter((key) => baseMethods.has(key))
  methodsToApply.forEach((method) => (entity[method] = baseEntityMethods()[method].bind(entity)))

  console.log('after convert', entity.toJSON())
}
