/** I have referred to 
 * https://gist.github.com/aendra-rininsland/32bc4fa0a9207b2cec8a9da331cab734
 * 
 * Super thanks!!!!!!!!!!!!!!!!!!
 */
import { WebSocketKeepAlive } from './websocket-keepalive'
import { Subscription } from '@atproto/xrpc-server'
import { isObj, hasProp } from '@atproto/lexicon'
import { ids } from '../lexicon/lexicons'
import { OperationsByType, isPost, isRepost, isLike, isFollow } from './subscription'
import { handleEvent } from '../subscription'
import { Database } from '../db' // This is the standard DB class from bluesky-social/feed-generator

export class JetstreamFirehoseSubscription {
  public sub: JetstreamSubscription<JetstreamEvent>

  constructor(public db: Database, public service: string, public collection: string = ids.AppBskyFeedPost) {
    this.sub = new JetstreamSubscription({
      service: service,
      method: 'subscribe',
      getParams: async () => ({
        cursor: await this.getCursor(),
        wantedCollections: collection,
      }),
      validate: (value: unknown) => {
        try {
          return value as JetstreamRecord // TODO validate??
        } catch (err) {
          console.error('repo subscription skipped invalid message', err)
        }
      },
    })
  }

  async run(subscriptionReconnectDelay: number) {
    let i = 0
    try {
      for await (const evt of this.sub) {
        try {
          if (isJetstreamCommit(evt)) {
            const ops = getJetstreamOpsByType(evt)
            await handleEvent(ops, this.db)
          }
        } catch (err) {
          console.error('repo subscription could not handle message', err)
        }
        i++
        // update stored cursor every 20 events or so
        if (isJetstreamCommit(evt) && i % 20 === 0) {
          await this.updateCursor(evt.time_us)
          i = 0
        }
      }
    } catch (err) {
      console.error('repo subscription errored', err)
      setTimeout(
        () => this.run(subscriptionReconnectDelay),
        subscriptionReconnectDelay,
      )
    }
  }

  async updateCursor(cursor: number) {
    await this.db
      .updateTable('sub_state')
      .set({ cursor })
      .where('service', '=', this.service)
      .execute()
  }

  async getCursor(): Promise<number | undefined> {
    const res = await this.db
      .selectFrom('sub_state')
      .selectAll()
      .where('service', '=', this.service)
      .executeTakeFirst()
    return res?.cursor
  }
}
function isJetstreamCommit(v: unknown): v is JetstreamEventKindCommit {
  return isObj(v) && hasProp(v, 'kind') && v.kind === 'commit'
}

export type JetstreamEvent = JetstreamEventKindCommit | JetstreamEventKindAccount | JetstreamEventKindIdentity

export interface JetstreamEventKindCommit {
  did: string
  time_us: number
  kind: 'commit'
  commit: JetstreamEventKindCommitOperationCreate | JetstreamEventKindCommitOperationUpdate | JetstreamEventKindCommitOperationDelete
}

export interface JetstreamEventKindCommitOperationCreate {
  rev: string
  operation: 'create'
  collection: string
  rkey: string
  record: JetstreamRecord
  cid: string
}

export interface JetstreamRecord {
  [k: string]: unknown
}

export interface JetstreamEventKindCommitOperationUpdate {
  rev: string
  operation: 'update'
  collection: string
  rkey: string
  [k: string]: unknown
}

export interface JetstreamEventKindCommitOperationDelete {
  rev: string
  operation: 'delete'
  collection: string
  rkey: string
}

export interface JetstreamEventKindAccount {
  did: string
  time_us: number
  kind: 'account'
  account: {
    active: boolean
    did: string
    seq: number
    time: string
  }
}

export interface JetstreamEventKindIdentity {
  did: string
  time_us: number
  kind: 'identity'
  identity: {
    did: string
    handle: string
    seq: number
    time: string
  }
}

class JetstreamSubscription<T = unknown> extends Subscription {
  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    const ws = new WebSocketKeepAlive({
      ...this.opts,
      getUrl: async () => {
        const params = (await this.opts.getParams?.()) ?? {}
        const query = encodeQueryParams(params)
        console.log(`Jetstream: ${this.opts.service}/${this.opts.method}?${query}`)
        return `${this.opts.service}/${this.opts.method}?${query}`
      },
    })
    for await (const chunk of ws) {
      try {
        const record = JSON.parse(Buffer.from(chunk).toString())
        yield record
      } catch (e) {
        console.error(e)
      }
    }
  }
}

function encodeQueryParams(obj: Record<string, unknown>): string {
  const params = new URLSearchParams()
  Object.entries(obj).forEach(([key, value]) => {
    const encoded = encodeQueryParam(value)
    if (Array.isArray(encoded)) {
      encoded.forEach((enc) => params.append(key, enc))
    } else {
      params.set(key, encoded)
    }
  })
  return params.toString()
}

// Adapted from xrpc, but without any lex-specific knowledge
function encodeQueryParam(value: unknown): string | string[] {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return value.toString()
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'undefined') {
    return ''
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString()
    } else if (Array.isArray(value)) {
      return value.flatMap(encodeQueryParam)
    } else if (!value) {
      return ''
    }
  }
  throw new Error(`Cannot encode ${typeof value}s into query params`)
}

const getJetstreamOpsByType = (evt: JetstreamEventKindCommit): OperationsByType => {
  const opsByType: OperationsByType = {
    posts: { creates: [], deletes: [] },
    reposts: { creates: [], deletes: [] },
    likes: { creates: [], deletes: [] },
    follows: { creates: [], deletes: [] },
  }

  const uri = `at://${evt.did}/${evt.commit.collection}/${evt.commit.rkey}`

  if (evt.commit.operation === 'update') {} // updates not supported yet

  if (evt.commit.operation === 'create') {
    if (evt.commit.collection === ids.AppBskyFeedPost && isPost(evt.commit.record)) {
      opsByType.posts.creates.push({ record: evt.commit.record, uri, cid: evt.commit.cid, author: evt.did })
    } else if (evt.commit.collection === ids.AppBskyFeedRepost && isRepost(evt.commit.record)) {
      opsByType.reposts.creates.push({ record: evt.commit.record, uri, cid: evt.commit.cid, author: evt.did })
    } else if (evt.commit.collection === ids.AppBskyFeedLike && isLike(evt.commit.record)) {
      opsByType.likes.creates.push({ record: evt.commit.record, uri, cid: evt.commit.cid, author: evt.did })
    } else if (evt.commit.collection === ids.AppBskyGraphFollow && isFollow(evt.commit.record)) {
      opsByType.follows.creates.push({ record: evt.commit.record, uri, cid: evt.commit.cid, author: evt.did })
    }
  }

  if (evt.commit.operation === 'delete') {
    if (evt.commit.collection === ids.AppBskyFeedPost) {
      opsByType.posts.deletes.push({ uri })
    } else if (evt.commit.collection === ids.AppBskyFeedRepost) {
      opsByType.reposts.deletes.push({ uri })
    } else if (evt.commit.collection === ids.AppBskyFeedLike) {
      opsByType.likes.deletes.push({ uri })
    } else if (evt.commit.collection === ids.AppBskyGraphFollow) {
      opsByType.follows.deletes.push({ uri })
    }
  }

  return opsByType
}
