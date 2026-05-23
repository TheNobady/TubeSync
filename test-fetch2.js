const apiUrl = "http://localhost:8080/api";
const roomCode = "TJQZCC";
fetch(`${apiUrl}/rooms/code/${roomCode}`)
  .then(res => {
    console.log("Status:", res.status);
    return res.json();
  })
  .then(console.log)
  .catch(console.error);
