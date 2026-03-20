import { RouterProvider } from 'react-router'
import { router } from '@/router/index'


function App() {

  return (
    <>
      <RouterProvider router={router} />
    </>
  )
}

export default App
