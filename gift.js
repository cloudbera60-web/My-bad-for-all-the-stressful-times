const fs = require('fs');
const path = require('path');

// Generate random ID
function giftedId(num = 8) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < num; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Generate random pairing code
function generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Remove file/directory
async function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    try {
        await fs.promises.rm(FilePath, { recursive: true, force: true });
        return true;
    } catch (error) {
        console.error("Remove file error:", error);
        return false;
    }
}

// Export all functions
module.exports = {
    giftedId,
    removeFile,
    generateRandomCode
};
