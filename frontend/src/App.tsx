import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [data, setData] = useState<string>("Loading...")

  useEffect(() => {
    fetch('http://localhost:3000')
      .then(res => res.text())
      .then(data => setData(data))
      .catch(err => {
        console.error(err)
        setData("Error connecting to API")
      })
  }, [])

  return (
    <div style={{ padding: "2rem" }}>
      <h1>FlySight</h1>
      <h2>API Response:</h2>
      <p>{data}</p>
    </div>
  )
}

export default App