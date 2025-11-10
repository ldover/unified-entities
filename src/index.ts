// @ts-nocheck
import { getThrottle, notArchivedOrDeleted, getLinks, processor, stringifyLink } from './util.js'
import type {
  ContentEditable,
  Entity,
  EntityKind,
  Self,
  Space,
  Collection,
  Note,
  Log,
  Image,
  Idea,
  Task,
  Issue,
  Highlight,
  AIChat,
  AIPrompt,
  AIResponse,
  Person,
  Song,
  Playlist
} from './entities.js'
import { KINDS, create } from './entities.js'

export { KINDS, defaultName, RecursiveContainmentError, completableKinds } from './entities.js'
export type {
  Entity,
  EntityKind,
  Self,
  Space,
  Collection,
  Note,
  Log,
  Image,
  Idea,
  Task,
  Issue,
  Highlight,
  AIChat,
  AIPrompt,
  AIResponse,
  Person,
  Song,
  Playlist,
  CompletableEntity,
  ParentRelation
} from './entities.js'


function entityFactory(obj) {
  const kind = obj.kind
  if (KINDS.includes(kind)) {
    return create(obj)
  } else {
    throw new Error(`Unsupported kind: ${kind}`)
  }
}

type EntityAPIOptions = {
    onCreate(entity: Entity): void
    onUpdate(entity: Entity): void
}

export class EntityAPI {
  private static instance: EntityAPI
  private entities: { [key: string]: EntityKind[] } = {}
  private listeners: Array<{
    filter: { operations: string[]; entityNames?: string[] }
    listener: Function
  }> = []
  private entityIdMap = new Map<string, EntityKind>()
  private childMap = new Map<string, Entity[]>()

  private onUpdate?: (entity: Entity) => void
  private onCreate?: (entity: Entity) => void


  // Private constructor for Singleton
  private constructor(options: Partial<EntityAPIOptions> = {}) {
    KINDS.forEach((key) => {
      this.entities[key] = []
    })

    this.onUpdate = options.onUpdate
    this.onCreate = options.onCreate
  }

  public static getInstance(): EntityAPI {
    if (!EntityAPI.instance) {
      EntityAPI.instance = new EntityAPI()
    }
    return EntityAPI.instance
  }

  public async load(all: Entity[]): Promise<void> {

    const setup = (kind: string, obj: any) => {
      const entityInstance = create(obj)
      if (!this.entities[kind]) {
        this.entities[kind] = []
      }
      this.entities[kind].push(entityInstance)
      this.entityIdMap.set(entityInstance.id, entityInstance)
      this._observe(entityInstance)
    }

    for (const e of all) {
      if (!KINDS.includes(e.kind)) {
        console.warn('unrecognized kind', e)
        continue 
      }

      setup(e.kind, e)
    }

    this.interlink(this.entities)
    this.applyNoArchivedOrDeletedInEntitiesArrayRule(this.entities)
    this.addLinks(this.entities)
    this.addBacklinks(this.entities)
    this.computeAliveness()
  }

  public getRoot(): Self | null {
    return this.entities['self'][0] as Self || null
  }

  public getChildren(entity: Entity): Entity[] {
    return entity.entities.concat((this.childMap.get(entity.id) || []).filter(e => !entity.has(e.id)))
  }

  public getUncategorized(): EntityKind[] {
    const allEntities = Object.values(this.entities).reduce(
      (total, next) => [...total, ...next],
      []
    )
    return allEntities.filter((e) => !e.parents.length)
  }

  public query(
    filter?: {
      entityNames?: string[]
      archived?: boolean
      deleted?: boolean
      parents?: 'with' | 'without'
    },
    filterFn?: (entity: EntityKind) => boolean
  ): EntityKind[] {
    let result: EntityKind[] = []

    if (filter && filter.entityNames && filter.entityNames.length > 0) {
      filter.entityNames.forEach((entityName) => {
        if (this.entities[entityName]) {
          result = [...result, ...this.entities[entityName]]
        }
      })
    } else {
      result = Object.values(this.entities).reduce((total, next) => [...total, ...next], [])
    }

    if (!filter) {
      return result
    }

    result = result.filter((entity) => {
      const archivedMatch =
        filter.archived !== undefined ? entity.archived === filter.archived : true
      const deletedMatch =
        filter.deleted !== undefined ? (entity.deleted) === filter.deleted : true

      // Filter by 'parents' if specified.
      const parentsMatch =
        filter.parents !== undefined
          ? filter.parents === 'with'
            ? entity.parents.length > 0
            : filter.parents === 'without'
              ? entity.parents.length === 0
              : true
          : true

      return archivedMatch && deletedMatch && parentsMatch
    })

    // Apply custom filter function if provided.
    if (filterFn) {
      result = result.filter(filterFn)
    }

    return result
  }

  public getEntities(entityName: string, filterFn?: (entity: EntityKind) => boolean): EntityKind[] {
    if (filterFn) {
      return this.entities[entityName].filter(filterFn)
    }
    return this.entities[entityName]
  }

  public getSpaces(filterFn?: (entity: EntityKind) => boolean): Space[] {
    return this.getEntities('space', filterFn)
  }

  public create(obj: any, origin: 'user' | 'external' | 'drop' = 'user'): EntityKind {
    const entity = entityFactory(obj)

    if (entity.kind == 'self' && this.entities['self'].length) {
      throw new Error('Cannot create two self entities')
    }

    this.computeAliveness()
    this.entities[entity.kind].push(entity)

    this.entityIdMap.set(entity.id, entity)
    this._observe(entity)

    this.onCreate?.(entity)

    this.emit('create', entity, origin)
    return entity
  }

  public get(id: string): Entity | null {
    if (this.entityIdMap.has(id)) {
      return this.entityIdMap.get(id) as EntityKind
    }

    return null
  }

  public on(filter: { operations: string[]; entityNames?: string[] }, listener: Function): void {
    this.listeners.push({ filter, listener })
  }

  public off(listener: Function): void {
    this.listeners = this.listeners.filter((l) => {
      return l.listener !== listener
    })
  }

  public emit(
    operation: string,
    entity: EntityKind,
    origin: 'user' | 'external' | 'drop' = 'user',
    props: any[]
  ): void {
    this.listeners
      .filter((l) => {
        const operationMatch = l.filter.operations.includes(operation)
        const entityNameMatch =
          !l.filter.entityNames || l.filter.entityNames.includes(entity.kind)
        return operationMatch && entityNameMatch
      })
      .forEach(({ listener }) => {
        listener(entity, origin, props)
      })
  }

  private _observe(entity: EntityKind): void {
    const throttle = getThrottle()

    const originalDelete = entity.delete
    entity.delete = () => {
      throttle.flush() // Flush any lingering updates to avoid an update call AFTER this delete call
      originalDelete.apply(entity)

      this.onUpdate?.(entity)
      this.emit('delete', entity)
    }

    const originalUpdate = entity.update
    const self = this

    const throttledUpdate = throttle(() => {
      this.onUpdate?.(entity)
    }, 5000)

    entity.update = function () {
      originalUpdate.apply(entity)
      self.emit('update', entity)

      throttledUpdate()
    }

    const originalSetName = entity.setName
    entity.setName = (name) => {
      originalSetName.apply(entity, [name])
      this.emit('rename', entity)
    }

    const originalConvert = entity.convert
    entity.convert = (kind) => {
      originalConvert.apply(entity, [kind])
      this.emit('convert', entity)
    }

    const originalArchive = entity.archive
    entity.archive = () => {
      originalArchive.apply(entity)
      this.emit('archive', entity)
    }

    const originalUnarchive = entity.unarchive
    entity.unarchive = () => {
      originalUnarchive.apply(entity)
      this.emit('unarchive', entity)
    }

    const originalRestore = entity.restore
    entity.restore = () => {
      originalRestore.apply(entity)
      this.emit('restore', entity)
    }

    const originalDraft = entity.markDraft
    entity.markDraft = (draft: boolean) => {
      originalDraft.apply(entity, [draft])
      this.emit(draft ? 'mark-draft' : 'complete-draft', entity)
    }

    const originalInsert = entity.insert
    entity.insert = (index: number, ...entities: EntityKind[]) => {
      originalInsert.apply(entity, [index, ...entities])
      this.emit('insert', entity, undefined, {index, entities})
    }

    // Wrap addParent/removeParent and keep childMap in sync

    const originalAddParent = entity.addParent
    entity.addParent = (parent: Entity, properties = {}) => {
      originalAddParent.apply(entity, [parent, properties])

      const children = this.childMap.get(parent.id)
      if (children) {
        if (!children.includes(entity)) {
          children.push(entity)
        }
      } else {
        this.childMap.set(parent.id, [entity])
      }
    }

    const originalRemoveParent = entity.removeParent
    entity.removeParent = (parent: Entity) => {
      originalRemoveParent.apply(entity, [parent])

      const children = this.childMap.get(parent.id)
      if (!children) {
        return
      }

      const updatedChildren = children.filter((child) => child.id !== entity.id)
      if (updatedChildren.length) {
        this.childMap.set(parent.id, updatedChildren)
      } else {
        this.childMap.delete(parent.id)
      }
    }

    const originalRemove = entity.remove
    entity.remove = (id: string) => {
      originalRemove.apply(entity, [id])
      this.emit('remove', entity, undefined, {id})
    }

    const originalSetOrder = entity.setOrder
    entity.setOrder = (entities) => {
      originalSetOrder.apply(entity, [entities])
      this.emit('new-order', entity)
    }

    // Update backlinks prop of all entities linked to
    entity.on('update-links', (links: EntityLink[]) => {
      const entitiesToUpdate = new Set(links.map(l => l.entity))

      entitiesToUpdate.forEach(id => {
        const target = this.get(id)
        if (target) {  // If this target entity exist, update its backlinks
          const newBacklinks = links.filter(l => l.entity == id)
          // Old backlinks without this entity
          const oldBacklinks = target.backlinks.filter(backlink => backlink.source.id != entity.id);
          target.backlinks = [
              ...oldBacklinks,
            ...newBacklinks
          ]
        }
      })
    })
  }

  // Removes the archived and deleted entities from Entity.entities
  private applyNoArchivedOrDeletedInEntitiesArrayRule(entities: { [key: string]: EntityKind[] }) {
    Object.values(entities).reduce(
      (total, next) => [...total, ...next],
      []
    ).forEach((c) => c.entities = c.entities.filter(e => notArchivedOrDeleted(e)))
  }

  private interlink(entities: { [key: string]: EntityKind[] }): void {
    const allEntities = Object.values(entities).reduce(
      (total, next) => [...total, ...next],
      []
    )
    allEntities.forEach((c) => {
      c.entities = c.entities
        .map((id) => {
          // todo: fix this weird two-step process where EntityKind.entities are first string[] then mapped to EntityKind[]
          const instance = this.entityIdMap.get(id)
          if (!instance) {
            console.warn('Child not found: entity with id does not exist', id)
          }
          return instance
        })
        .filter(Boolean) as EntityKind[]
    })

    // Build a lookup of parent id -> active children
    this.childMap.clear()
    allEntities.forEach((child) => {
      child.parents
        .forEach((relation) => {
          const instance = this.entityIdMap.get(relation.id)
          if (!instance) return
          relation.target = instance
          const children = this.childMap.get(relation.id)
          if (children) {
            if (!children.includes(child)) {
              children.push(child)
            }
          } else {
            this.childMap.set(relation.id, [child])
          }
        })
    })

    const MAP_PROPS = ['context', 'created_by', 'updated_by', 'deleted_by'] as const

    Object.values(this.entities)
      .flat()
      .forEach((e) => {
        for (const prop of MAP_PROPS) {
          const id = e[prop]
          if (id) {
            const instance = this.entityIdMap.get(id) || null
            e[prop] = instance
    
            if (!instance) {
              console.warn(
                `${prop} not found: entity with id=${id} does not exist. ` +
                  `Beware: setting ${prop} to null.`
              )
            }
          }
        }
      })
  }

  private addLinks(entities: { [key: string]: Entity[] }): void {
    // Parse all entities with content
    for (const kind of KINDS) {
      entities[kind].forEach((entity) => {
        if ((entity as any as ContentEditable).content) {
          let links = parseLinks(entity);
          entity.links = links
        }
      })
    }
  }

  private addBacklinks(entities: { [key: string]: Entity[] }): void {
    const linkMap = this.createLinkMap(this.entities)

    Object.values(entities)
      .reduce((total, next) => [...total, ...next], [])
      .forEach((entity) => {
        let backlinks = linkMap.get(entity.id);
        if (backlinks) {
          entity.backlinks = backlinks
        }
      })
  }

  private createLinkMap(entities: { [key: string]: EntityKind[] }) {
    const flat = Object.values(entities).reduce((total, next) => [...total, ...next], []);
    return createLinkMap(flat)
  }

  public computeAliveness() {
    const flat = Object.values(this.entities).reduce((total, next) => [...total, ...next], []);
    const descendantCountCache = new Map<string, number>()

    const countDescendants = (entity: EntityKind, seen: Set<string>): number => {
      return (entity.entities || []).reduce((total, child) => {
        if (!child || seen.has(child.id)) {
          return total
        }

        seen.add(child.id)
        const childCount =
          descendantCountCache.get(child.id) ??
          countDescendants(child, new Set(seen))

        if (!descendantCountCache.has(child.id)) {
          descendantCountCache.set(child.id, childCount)
        }

        return total + 1 + childCount
      }, 0)
    }

    const getDescendantCount = (entity: EntityKind): number => {
      if (descendantCountCache.has(entity.id)) {
        return descendantCountCache.get(entity.id) as number
      }
      const count = countDescendants(entity, new Set([entity.id]))
      descendantCountCache.set(entity.id, count)
      return count
    }
    
    // Exponential decay curve: At day 0 it's 1, at day 10 it's 0.5 at day 100 it's ~0
    const exp = (days: number) => Math.pow(0.5, days/10)

    let maxRelationalAliveness = 0
    let maxTemporalAliveness = 0

    flat.forEach(e => {
      const daysSinceTouched = (Date.now() - (e.updated_at || e.created_at) * 1000) / (3600 * 24 * 1000)
      e.temporalAliveness = exp(daysSinceTouched)
      
      let relationalAliveness = 0
      relationalAliveness += e.backlinks.length           // incoming
      relationalAliveness += e.links.length               // outgoing links
      relationalAliveness += getDescendantCount(e)        // mass of the frame includes all descendants
      relationalAliveness += e.parents.length
      
      e.relationalAliveness = relationalAliveness

      if (maxRelationalAliveness < e.relationalAliveness) {
        maxRelationalAliveness = e.relationalAliveness
      } 

      if (maxTemporalAliveness < e.temporalAliveness) {
        maxTemporalAliveness = e.temporalAliveness
      } 
    })

    flat.forEach(e => {
      e.aliveness = 0.5 * (e.relationalAliveness / maxRelationalAliveness) + 0.5 * (e.temporalAliveness / maxTemporalAliveness)
    })
  }
}

/**
 * Creates a map of backlinks.
 */
function createLinkMap(entities: Entity[]): Map<string, EntityLink[]> {
  const linkMap = new Map();
  for (const entity of entities) {
    linkMap.set(entity.id, [])
  }

  for (const entity of entities) {
    if (entity.links) {
      for (const link of entity.links) {
        linkMap.get(link.entity)?.push(link)
      }
    }
  }

  return linkMap;
}


export interface EntityLink {
  name: string
  path: string

  source: Entity
  entity: string

  context: any
}

export const parseLinks = (entity: Entity): EntityLink[] => {
  const tree = processor.parse(entity.content)
  const links = getLinks(tree)
  return links
    .filter((link) => link.node.url.startsWith('user://'))
    .map((link) => {
      const id = link.node.url.replace('user://', '')

      return {
        name: stringifyLink(link.node),
        path: link.node.url,
        entity: id,
        context: link.context,
        source: entity
      }
    })
}
