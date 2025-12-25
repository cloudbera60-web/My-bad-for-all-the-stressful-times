const axios = require('axios');

class PaymentService {
    constructor() {
        this.authToken = process.env.PAYHERO_AUTH_TOKEN || '';
        this.channelId = process.env.CHANNEL_ID || '3342';
        this.baseURL = 'https://payherokenya.com/sbs/payhero/';
    }

    async sendSTKPush(phone, amount, reference) {
        try {
            // Format phone number
            let formattedPhone = phone.replace(/\D/g, '');
            
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '254' + formattedPhone.substring(1);
            } else if (formattedPhone.startsWith('+')) {
                formattedPhone = formattedPhone.substring(1);
            }
            
            if (!formattedPhone.startsWith('254')) {
                formattedPhone = '254' + formattedPhone;
            }

            const payload = {
                channel_id: this.channelId,
                auth_token: this.authToken,
                provider: "m-pesa",
                account_number: formattedPhone,
                amount: parseFloat(amount),
                transaction_reference: reference,
                narration: `Payment from Gifted-MD - ${reference}`
            };

            console.log('📱 Sending STK Push:', payload);

            const response = await axios.post(
                `${this.baseURL}core_api/transact/`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            console.log('✅ STK Push Response:', response.data);

            if (response.data && response.data.status === 'success') {
                return {
                    success: true,
                    message: `STK push sent to ${formattedPhone}. Check your phone to complete payment.`,
                    reference: reference,
                    transactionId: response.data.transaction_id,
                    providerResponse: response.data
                };
            } else {
                return {
                    success: false,
                    message: response.data.message || 'Failed to send STK push',
                    error: response.data
                };
            }
        } catch (error) {
            console.error('❌ STK Push Error:', error.message);
            
            if (error.response) {
                return {
                    success: false,
                    message: error.response.data.message || 'Payment service error',
                    error: error.response.data
                };
            } else if (error.request) {
                return {
                    success: false,
                    message: 'No response from payment service',
                    error: error.message
                };
            } else {
                return {
                    success: false,
                    message: 'Error configuring payment request',
                    error: error.message
                };
            }
        }
    }

    async checkPaymentStatus(reference) {
        try {
            const payload = {
                channel_id: this.channelId,
                auth_token: this.authToken,
                transaction_reference: reference
            };

            console.log('🔍 Checking payment status:', payload);

            const response = await axios.post(
                `${this.baseURL}core_api/check/`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            console.log('✅ Payment Status Response:', response.data);

            if (response.data) {
                const status = response.data.status || 'unknown';
                let message = '';
                
                switch(status.toLowerCase()) {
                    case 'success':
                        message = `Payment ${reference} completed successfully`;
                        break;
                    case 'pending':
                        message = `Payment ${reference} is pending. Please check your phone`;
                        break;
                    case 'failed':
                        message = `Payment ${reference} failed. Please try again`;
                        break;
                    default:
                        message = `Payment ${reference} status: ${status}`;
                }

                return {
                    success: true,
                    status: status,
                    message: message,
                    details: response.data
                };
            }

            return {
                success: false,
                message: 'Unable to check payment status',
                error: response.data
            };
        } catch (error) {
            console.error('❌ Check Payment Status Error:', error.message);
            return {
                success: false,
                message: 'Error checking payment status',
                error: error.message
            };
        }
    }

    async checkWalletBalance() {
        try {
            const payload = {
                channel_id: this.channelId,
                auth_token: this.authToken
            };

            console.log('💰 Checking wallet balance');

            const response = await axios.post(
                `${this.baseURL}core_api/balance/`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            console.log('✅ Wallet Balance Response:', response.data);

            if (response.data && response.data.balance !== undefined) {
                return {
                    success: true,
                    balance: response.data.balance,
                    currency: response.data.currency || 'KES',
                    message: `Current balance: ${response.data.currency || 'KES'} ${response.data.balance}`
                };
            }

            return {
                success: false,
                message: 'Unable to check balance',
                error: response.data
            };
        } catch (error) {
            console.error('❌ Check Balance Error:', error.message);
            return {
                success: false,
                message: 'Error checking wallet balance',
                error: error.message
            };
        }
    }

    generateReference() {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `GFT${timestamp}${random}`;
    }

    validatePhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length >= 9 && cleaned.length <= 12;
    }

    validateAmount(amount) {
        const num = parseFloat(amount);
        return !isNaN(num) && num > 0 && num <= 150000; // M-Pesa limit
    }
}

// Create singleton instance
const paymentService = new PaymentService();

module.exports = paymentService;
