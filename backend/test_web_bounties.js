async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/bounties');
    console.log('Status:', res.status);
    console.log('Body:', await res.json());
  } catch (e) {
    console.error('Fetch failed:', e.message);
  }
}
run();
