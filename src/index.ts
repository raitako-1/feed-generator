import dotenv from 'dotenv'
import FeedGenerator from './server'

const run = async () => {
  dotenv.config()
  const hostname = maybeStr(process.env.FEEDGEN_HOSTNAME) ?? 'example.com'
  const serviceDid =
    maybeStr(process.env.FEEDGEN_SERVICE_DID) ?? `did:web:${hostname}`
  const server = FeedGenerator.create({
    port: maybeInt(process.env.FEEDGEN_PORT) ?? 3000,
    listenhost: maybeStr(process.env.FEEDGEN_LISTENHOST) ?? 'localhost',
    sqliteLocation: maybeStr(process.env.FEEDGEN_SQLITE_LOCATION) ?? ':memory:',
    subscriptionFirehoseEndpoint:
      maybeStr(process.env.FEEDGEN_SUBSCRIPTION_FIREHOSE_ENDPOINT) ??
      'wss://bsky.network',
    subscriptionJetstreamEndpoint:
      maybeStr(process.env.FEEDGEN_SUBSCRIPTION_JETSTREAM_ENDPOINT) ??
      'wss://jetstream1.us-east.bsky.network',
    subscriptionTurbostreamEndpoint:
      maybeStr(process.env.FEEDGEN_SUBSCRIPTION_TURBOSTREAM_ENDPOINT) ??
      'wss://api.graze.social/app/api/v1/turbostream/turbostream',
    subscriptionMode:
      maybeStr(process.env.FEEDGEN_SUBSCRIPTION_MODE) ?? 'Firehose',
    publisherDid:
      maybeStr(process.env.FEEDGEN_PUBLISHER_DID) ?? 'did:example:alice',
    subscriptionReconnectDelay:
      maybeInt(process.env.FEEDGEN_SUBSCRIPTION_RECONNECT_DELAY) ?? 3000,
    hostname,
    serviceDid,
  })
  await server.start()
  console.log(
    `🤖 running feed generator at http://${server.cfg.listenhost}:${server.cfg.port}`,
  )
}

const maybeStr = (val?: string) => {
  if (!val) return undefined
  return val
}

const maybeInt = (val?: string) => {
  if (!val) return undefined
  const int = parseInt(val, 10)
  if (isNaN(int)) return undefined
  return int
}

run()
