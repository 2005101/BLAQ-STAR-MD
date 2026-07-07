const express = require('express')
const path = require('path')
const app = express()
app.use(express.static('public'))
app.use(express.json())

app.get('/', (req,res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'))
})

app.listen(3000, () => console.log('Web running'))
