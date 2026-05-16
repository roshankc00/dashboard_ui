import { Uploads } from '@/modules/uploads/Upload'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'URL Batch Checker',
  description: 'Paste URLs or upload a CSV — one URL per line. Refresh-safe: batch state is saved in the URL and restored from the API.',
}

const Home = () => {
  return (
    <div><Uploads /></div>
  )
}

export default Home