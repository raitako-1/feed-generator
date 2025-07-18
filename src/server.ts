import http from 'http'
import events from 'events'
import express from 'express'
import { DidResolver, MemoryCache } from '@atproto/identity'
import { createServer } from './lexicon'
import feedGeneration from './methods/feed-generation'
import describeGenerator from './methods/describe-generator'
import { createDb, type Database, migrateToLatest } from './db'
import { FirehoseSubscription } from './util/subscription'
import { JetstreamFirehoseSubscription } from './util/jetstream-subscription'
import { TurbostreamFirehoseSubscription } from './util/turbostream-subscription'
import { type AppContext, type Config } from './config'
import wellKnown from './well-known'

export class FeedGenerator {
  public app: express.Application
  public server?: http.Server
  public db: Database
  public firehose: FirehoseSubscription | JetstreamFirehoseSubscription | TurbostreamFirehoseSubscription
  public cfg: Config

  constructor(
    app: express.Application,
    db: Database,
    firehose: FirehoseSubscription | JetstreamFirehoseSubscription | TurbostreamFirehoseSubscription,
    cfg: Config,
  ) {
    this.app = app
    this.db = db
    this.firehose = firehose
    this.cfg = cfg
  }

  static create(cfg: Config) {
    const app = express()
    const db = createDb(cfg.sqliteLocation)

    const didCache = new MemoryCache()
    const didResolver = new DidResolver({
      plcUrl: 'https://plc.directory',
      didCache,
    })

    const server = createServer({
      validateResponse: true,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })
    const ctx: AppContext = {
      db,
      didResolver,
      cfg,
    }
    feedGeneration(server, ctx)
    describeGenerator(server, ctx)
    app.use(server.xrpc.router)
    app.use(wellKnown(ctx))

    if (cfg.subscriptionMode === 'Firehose') {
      const firehose = new FirehoseSubscription(db, cfg.subscriptionFirehoseEndpoint)
      return new FeedGenerator(app, db, firehose, cfg)
    } else if (cfg.subscriptionMode === 'Jetstream') {
      const firehose = new JetstreamFirehoseSubscription(db, cfg.subscriptionJetstreamEndpoint)
      return new FeedGenerator(app, db, firehose, cfg)
    } else if (cfg.subscriptionMode === 'Turbostream') {
      const firehose = new TurbostreamFirehoseSubscription(db, cfg.subscriptionTurbostreamEndpoint)
      return new FeedGenerator(app, db, firehose, cfg)
    } else {
      throw new Error('Invalid FEEDGEN_SUBSCRIPTION_MODE')
    }
  }

  async start(): Promise<http.Server> {
    await migrateToLatest(this.db)
    this.firehose.run(this.cfg.subscriptionReconnectDelay)
    this.server = this.app.listen(this.cfg.port, this.cfg.listenhost)
    await events.once(this.server, 'listening')
    return this.server
  }
}

export default FeedGenerator
