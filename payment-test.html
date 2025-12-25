<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GIFTED MD | Payment Test</title>
    <style>
        :root {
            --primary: #8a2be2;
            --secondary: #9932cc;
            --background: #121212;
            --card-bg: #1e1e1e;
            --text: #ffffff;
            --success: #4caf50;
            --error: #f44336;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Poppins', sans-serif;
            background: var(--background);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            width: 100%;
            max-width: 600px;
            margin-top: 50px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            color: var(--primary);
            margin-bottom: 10px;
            font-size: 2.5rem;
        }
        
        .header p {
            color: #aaa;
            font-size: 1.1rem;
        }
        
        .card {
            background: var(--card-bg);
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            margin-bottom: 20px;
            border: 1px solid rgba(138, 43, 226, 0.2);
        }
        
        .card h2 {
            color: var(--primary);
            margin-bottom: 20px;
            font-size: 1.5rem;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #ddd;
            font-weight: 500;
        }
        
        .form-group input {
            width: 100%;
            padding: 12px 15px;
            background: #2d2d2d;
            border: 2px solid rgba(138, 43, 226, 0.3);
            border-radius: 8px;
            color: var(--text);
            font-size: 1rem;
            transition: all 0.3s;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(138, 43, 226, 0.2);
        }
        
        .btn {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            margin-top: 10px;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(138, 43, 226, 0.4);
        }
        
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 8px;
            display: none;
        }
        
        .success {
            background: rgba(76, 175, 80, 0.1);
            border-left: 4px solid var(--success);
            color: var(--success);
            display: block;
        }
        
        .error {
            background: rgba(244, 67, 54, 0.1);
            border-left: 4px solid var(--error);
            color: var(--error);
            display: block;
        }
        
        .info {
            background: rgba(138, 43, 226, 0.1);
            border-left: 4px solid var(--primary);
            color: var(--primary);
            display: block;
        }
        
        .back-btn {
            display: inline-block;
            padding: 10px 20px;
            background: transparent;
            color: var(--primary);
            border: 2px solid var(--primary);
            border-radius: 30px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
        }
        
        .back-btn:hover {
            background: rgba(138, 43, 226, 0.1);
        }
        
        .loading {
            display: none;
            text-align: center;
            margin: 20px 0;
        }
        
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(138, 43, 226, 0.2);
            border-top: 4px solid var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 480px) {
            .container {
                padding: 10px;
            }
            
            .card {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>GIFTED MD Payment Test</h1>
            <p>Test M-Pesa payment functionality</p>
        </div>
        
        <div class="card">
            <h2>Test Payment</h2>
            
            <div class="form-group">
                <label for="phone">Phone Number</label>
                <input type="text" id="phone" placeholder="e.g., 2547xxxxxxxx or 0712345678">
            </div>
            
            <div class="form-group">
                <label for="amount">Amount (KES)</label>
                <input type="number" id="amount" placeholder="e.g., 100" min="1" max="150000">
            </div>
            
            <button class="btn" id="test-btn">Test Payment</button>
            
            <div class="loading" id="loading">
                <div class="spinner"></div>
                <p>Processing payment...</p>
            </div>
            
            <div class="result" id="result"></div>
        </div>
        
        <div class="card">
            <h2>Check Payment Status</h2>
            
            <div class="form-group">
                <label for="reference">Reference Number</label>
                <input type="text" id="reference" placeholder="e.g., GFT123456789">
            </div>
            
            <button class="btn" id="status-btn">Check Status</button>
            
            <div class="loading" id="status-loading">
                <div class="spinner"></div>
                <p>Checking status...</p>
            </div>
            
            <div class="result" id="status-result"></div>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
            <a href="./" class="back-btn">Back to Home</a>
        </div>
    </div>

    <script>
        document.getElementById('test-btn').addEventListener('click', async () => {
            const phone = document.getElementById('phone').value.trim();
            const amount = document.getElementById('amount').value.trim();
            
            if (!phone || !amount) {
                showResult('error', 'Please fill in all fields');
                return;
            }
            
            const btn = document.getElementById('test-btn');
            const loading = document.getElementById('loading');
            const result = document.getElementById('result');
            
            btn.disabled = true;
            loading.style.display = 'block';
            result.style.display = 'none';
            
            try {
                const response = await fetch('/test-payment', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ phone, amount })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showResult('success', data.message);
                } else {
                    showResult('error', data.message || 'Payment failed');
                }
            } catch (error) {
                showResult('error', 'Network error. Please try again.');
            } finally {
                btn.disabled = false;
                loading.style.display = 'none';
            }
        });
        
        document.getElementById('status-btn').addEventListener('click', async () => {
            const reference = document.getElementById('reference').value.trim();
            
            if (!reference) {
                showStatusResult('error', 'Please enter a reference number');
                return;
            }
            
            const btn = document.getElementById('status-btn');
            const loading = document.getElementById('status-loading');
            const result = document.getElementById('status-result');
            
            btn.disabled = true;
            loading.style.display = 'block';
            result.style.display = 'none';
            
            try {
                const response = await fetch(`/test-status?reference=${encodeURIComponent(reference)}`);
                const data = await response.json();
                
                if (data.success) {
                    showStatusResult('success', data.message);
                } else {
                    showStatusResult('error', data.message || 'Status check failed');
                }
            } catch (error) {
                showStatusResult('error', 'Network error. Please try again.');
            } finally {
                btn.disabled = false;
                loading.style.display = 'none';
            }
        });
        
        function showResult(type, message) {
            const result = document.getElementById('result');
            result.className = `result ${type}`;
            result.textContent = message;
            result.style.display = 'block';
        }
        
        function showStatusResult(type, message) {
            const result = document.getElementById('status-result');
            result.className = `result ${type}`;
            result.textContent = message;
            result.style.display = 'block';
        }
    </script>
</body>
</html>
