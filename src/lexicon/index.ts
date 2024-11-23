/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  createServer as createXrpcServer,
  Server as XrpcServer,
  Options as XrpcOptions,
  AuthVerifier,
  StreamAuthVerifier,
} from '@atproto/xrpc-server'
import { schemas } from './lexicons'
import * as AppBskyFeedDescribeFeedGenerator from './types/app/bsky/feed/describeFeedGenerator'
import * as AppBskyFeedGetFeedSkeleton from './types/app/bsky/feed/getFeedSkeleton'
import * as ComAtprotoSyncSubscribeRepos from './types/com/atproto/sync/subscribeRepos'

export function createServer(options?: XrpcOptions): Server {
  return new Server(options)
}

export class Server {
  xrpc: XrpcServer
  app: AppNS
  com: ComNS

  constructor(options?: XrpcOptions) {
    this.xrpc = createXrpcServer(schemas, options)
    this.app = new AppNS(this)
    this.com = new ComNS(this)
  }
}

export class AppNS {
  _server: Server
  bsky: AppBskyNS

  constructor(server: Server) {
    this._server = server
    this.bsky = new AppBskyNS(server)
  }
}

export class AppBskyNS {
  _server: Server
  actor: AppBskyActorNS
  feed: AppBskyFeedNS
  graph: AppBskyGraphNS

  constructor(server: Server) {
    this._server = server
    this.actor = new AppBskyActorNS(server)
    this.feed = new AppBskyFeedNS(server)
    this.graph = new AppBskyGraphNS(server)
  }
}

export class AppBskyActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class AppBskyFeedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  describeFeedGenerator<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      AppBskyFeedDescribeFeedGenerator.Handler<ExtractAuth<AV>>,
      AppBskyFeedDescribeFeedGenerator.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'app.bsky.feed.describeFeedGenerator' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFeedSkeleton<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      AppBskyFeedGetFeedSkeleton.Handler<ExtractAuth<AV>>,
      AppBskyFeedGetFeedSkeleton.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'app.bsky.feed.getFeedSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppBskyGraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class ComNS {
  _server: Server
  atproto: ComAtprotoNS

  constructor(server: Server) {
    this._server = server
    this.atproto = new ComAtprotoNS(server)
  }
}

export class ComAtprotoNS {
  _server: Server
  repo: ComAtprotoRepoNS
  sync: ComAtprotoSyncNS

  constructor(server: Server) {
    this._server = server
    this.repo = new ComAtprotoRepoNS(server)
    this.sync = new ComAtprotoSyncNS(server)
  }
}

export class ComAtprotoRepoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class ComAtprotoSyncNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  subscribeRepos<AV extends StreamAuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoSyncSubscribeRepos.Handler<ExtractAuth<AV>>,
      ComAtprotoSyncSubscribeRepos.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.sync.subscribeRepos' // @ts-ignore
    return this._server.xrpc.streamMethod(nsid, cfg)
  }
}

type SharedRateLimitOpts<T> = {
  name: string
  calcKey?: (ctx: T) => string
  calcPoints?: (ctx: T) => number
}
type RouteRateLimitOpts<T> = {
  durationMs: number
  points: number
  calcKey?: (ctx: T) => string
  calcPoints?: (ctx: T) => number
}
type HandlerOpts = { blobLimit?: number }
type HandlerRateLimitOpts<T> = SharedRateLimitOpts<T> | RouteRateLimitOpts<T>
type ConfigOf<Auth, Handler, ReqCtx> =
  | Handler
  | {
      auth?: Auth
      opts?: HandlerOpts
      rateLimit?: HandlerRateLimitOpts<ReqCtx> | HandlerRateLimitOpts<ReqCtx>[]
      handler: Handler
    }
type ExtractAuth<AV extends AuthVerifier | StreamAuthVerifier> = Extract<
  Awaited<ReturnType<AV>>,
  { credentials: unknown }
>
