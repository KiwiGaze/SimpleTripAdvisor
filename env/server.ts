// https://env.t3.gg/docs/nextjs#create-your-schema
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const serverEnv = createEnv({
  server: {
    XAI_API_KEY: z.string().min(1),
    TAVILY_API_KEY: z.string().min(1),
    OPENWEATHER_API_KEY: z.string().min(1),
    GOOGLE_MAPS_API_KEY: z.string().min(1),
    MAPBOX_ACCESS_TOKEN: z.string().min(1),
    TRIPADVISOR_API_KEY: z.string().min(1),
    AVIATION_STACK_API_KEY: z.string().min(1),
  },
  experimental__runtimeEnv: process.env,
})
