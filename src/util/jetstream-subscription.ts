import { WebSocketKeepAlive } from '../xrpc-server/stream/websocket-keepalive'
import { Subscription } from '@atproto/xrpc-server'
import { isObj, hasProp } from '@atproto/lexicon'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import { Database } from '../db' // This is the standard DB class from bluesky-social/feed-generator

export abstract class JetstreamFirehoseSubscriptionBase {
  public sub: JetstreamSubscription

  constructor(public db: Database, public service: string, public collection: string = 'app.bsky.feed.post') {
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

  abstract handleEvent(evt: JetstreamEvent): Promise<void>

  async run(subscriptionReconnectDelay: number) {
    let i = 0
    try {
      for await (const evt of this.sub) {
        this.handleEvent(evt as JetstreamEvent).catch((err) => {
          console.error('repo subscription could not handle message', err)
        })
        i++
        // update stored cursor every 20 events or so
        if (isJetstreamCommit(evt) && i % 20 === 0) {
          await this.updateCursor(evt.time_us)
          i = 0
        }
      }
    } catch (err) {
      console.error('repo subscription errored', err)
      setTimeout(() => this.run(subscriptionReconnectDelay), subscriptionReconnectDelay)
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
export function isJetstreamCommit(v: unknown): v is JetstreamEvent {
  return isObj(v) && hasProp(v, 'kind') && v.kind === 'commit'
}

export interface JetstreamEvent {
  did: string
  time_us: number
  kind: string
  commit: JetstreamCommit
}

export interface JetstreamCommit {
  rev: string
  operation: string
  collection: string
  rkey: string
  record: JetstreamRecord
  cid: string
}

export interface JetstreamRecord extends PostRecord {}

export interface JetstreamSubject {
  cid: string
  uri: string
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

export const getJetstreamOpsByType = (evt: JetstreamEvent): OperationsByType => {
  const opsByType: OperationsByType = {
    posts: [],
  }

  if (
    evt?.commit?.collection === 'app.bsky.feed.post' &&
    evt?.commit?.operation === 'create' &&
    evt?.commit?.record
  ) {
    opsByType.posts.push(evt)
  }

  return opsByType
}

type OperationsByType = {
  posts: JetstreamEvent[]
}
