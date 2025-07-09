// JSON Form Handler
document.getElementById('jsonForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const textarea = e.target.querySelector('textarea');
  const result = document.getElementById('jsonResult');
  
  try {
    const response = await fetch('/api/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: textarea.value
    });
    
    const data = await response.json();
    result.textContent = JSON.stringify(data, null, 2);
    result.style.color = response.ok ? '#28a745' : '#dc3545';
  } catch (error) {
    result.textContent = `Error: ${error.message}`;
    result.style.color = '#dc3545';
  }
});

// Text Form Handler
document.getElementById('textForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const textarea = e.target.querySelector('textarea');
  const result = document.getElementById('textResult');
  
  try {
    const response = await fetch('/api/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: textarea.value
    });
    
    const data = await response.json();
    result.textContent = JSON.stringify(data, null, 2);
    result.style.color = response.ok ? '#28a745' : '#dc3545';
  } catch (error) {
    result.textContent = `Error: ${error.message}`;
    result.style.color = '#dc3545';
  }
});

console.log('Demo JavaScript loaded successfully!');