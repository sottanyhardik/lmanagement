export const loginUser = async (username, password) => {
  const res = await fetch('http://localhost:8000/api/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return await res.json();
};
