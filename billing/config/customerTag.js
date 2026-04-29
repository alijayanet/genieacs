// Modul untuk menambahkan nomor pelanggan ke tag GenieACS
const axios = require('axios');
require('dotenv').config();
const { logger } = require('./logger');

let sock = null;

// Fungsi untuk set instance sock
function setSock(sockInstance) {
    sock = sockInstance;
}

// Fungsi untuk menambahkan tag pelanggan ke perangkat GenieACS
async function addCustomerTag(remoteJid, params) {
    try {
        // Ekstrak parameter
        if (params.length < 2) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *Format Salah*\n\nFormat yang benar:\naddtag [device_id] [nomor_pelanggan]\n\nContoh:\naddtag 202BC1-BM632w-000000 081234567890`
            });
            return;
        }

        const [deviceId, customerNumber] = params;
        
        // Validasi nomor pelanggan
        if (!customerNumber || !/^\d{8,}$/.test(customerNumber)) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *Nomor Pelanggan Tidak Valid*\n\nNomor pelanggan harus berupa angka minimal 8 digit.`
            });
            return;
        }
        
        // Dapatkan URL GenieACS
        const genieacsUrl = global.appSettings.genieacsUrl || process.env.GENIEACS_URL;
        if (!genieacsUrl) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *Konfigurasi tidak lengkap*\n\nURL GenieACS tidak dikonfigurasi`
            });
            return;
        }
        
        // Kirim pesan bahwa proses sedang berlangsung
        await sock.sendMessage(remoteJid, {
            text: `⏳ *Proses penambahan tag*\n\nSedang menambahkan nomor ${customerNumber} ke perangkat ${deviceId}...`
        });
        
        // Persiapkan URL untuk menambahkan tag
        const tagUrl = `${genieacsUrl}/devices/${deviceId}/tags/${customerNumber}`;
        
        // Kirim request ke GenieACS untuk menambahkan tag
        try {
            const response = await axios.post(
                tagUrl,
                {},
                {
                    auth: {
                        username: global.appSettings.genieacsUsername || process.env.GENIEACS_USERNAME,
                        password: global.appSettings.genieacsPassword || process.env.GENIEACS_PASSWORD
                    }
                }
            );
            
            logger.info(`Tag response: ${response.status}`);
            
            // Kirim pesan sukses
            let successMessage = `✅ *Tag berhasil ditambahkan*\n\n`;
            successMessage += `📱 *Nomor Pelanggan:* ${customerNumber}\n`;
            successMessage += `🖥️ *Device ID:* ${deviceId}\n\n`;
            successMessage += `Pelanggan sekarang dapat menggunakan WhatsApp dan Web Portal dengan nomor tersebut.`;
            
            await sock.sendMessage(remoteJid, { text: successMessage });
            
        } catch (error) {
            logger.error('Error adding tag to GenieACS:', error);
            
            let errorMessage = `❌ *Gagal menambahkan tag*\n\n`;
            if (error.response) {
                errorMessage += `Status: ${error.response.status}\n`;
                errorMessage += `Pesan: ${JSON.stringify(error.response.data)}\n`;
            } else {
                errorMessage += `Error: ${error.message}\n`;
            }
            
            await sock.sendMessage(remoteJid, { text: errorMessage });
        }
        
    } catch (error) {
        logger.error('Error in addCustomerTag:', error);
        
        await sock.sendMessage(remoteJid, {
            text: `❌ *Error*\n\nTerjadi kesalahan saat menambahkan tag: ${error.message}`
        });
    }
}

// Fungsi untuk mencari perangkat berdasarkan ID
async function findDeviceById(deviceId) {
    try {
        // Dapatkan URL GenieACS
        const genieacsUrl = global.appSettings.genieacsUrl || process.env.GENIEACS_URL;
        if (!genieacsUrl) {
            logger.error('GenieACS URL not configured');
            return null;
        }
        
        // Buat query untuk mencari perangkat berdasarkan ID
        const queryObj = { "_id": deviceId };
        const queryJson = JSON.stringify(queryObj);
        const encodedQuery = encodeURIComponent(queryJson);
        
        // Ambil perangkat dari GenieACS
        const response = await axios.get(`${genieacsUrl}/devices/?query=${encodedQuery}`, {
            auth: {
                username: global.appSettings.genieacsUsername || process.env.GENIEACS_USERNAME,
                password: global.appSettings.genieacsPassword || process.env.GENIEACS_PASSWORD
            },
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.data && response.data.length > 0) {
            return response.data[0];
        }
        
        return null;
    } catch (error) {
        logger.error(`Error finding device by ID: ${error.message}`);
        return null;
    }
}

// Fungsi untuk menambahkan tag berdasarkan PPPoE Username
async function addTagByPPPoE(remoteJid, params, sock) {
    try {
        // Ekstrak parameter
        if (params.length < 2) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *Format Salah*\n\nFormat yang benar:\naddpppoe_tag [pppoe_username] [nomor_pelanggan]\n\nContoh:\naddpppoe_tag user123 081234567890`
            });
            return;
        }

        const [pppoeUsername, customerNumber] = params;
        
        // Validasi nomor pelanggan
        if (!customerNumber || !/^\d{8,}$/.test(customerNumber)) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *Nomor Pelanggan Tidak Valid*\n\nNomor pelanggan harus berupa angka minimal 8 digit.`
            });
            return;
        }
        
        // Dapatkan URL GenieACS
        const genieacsUrl = global.appSettings.genieacsUrl || process.env.GENIEACS_URL;
        if (!genieacsUrl) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *Konfigurasi tidak lengkap*\n\nURL GenieACS tidak dikonfigurasi`
            });
            return;
        }
        
        // Kirim pesan bahwa proses sedang berlangsung
        await sock.sendMessage(remoteJid, {
            text: `⏳ *Proses pencarian perangkat*\n\nSedang mencari perangkat dengan PPPoE Username ${pppoeUsername}...`
        });
        
        // Cari perangkat berdasarkan PPPoE Username
        const device = await findDeviceByPPPoE(pppoeUsername);
        
        if (!device) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *Perangkat Tidak Ditemukan*\n\nTidak dapat menemukan perangkat dengan PPPoE Username ${pppoeUsername}`
            });
            return;
        }
        
        // Dapatkan device ID
        const deviceId = device._id;
        
        // Kirim pesan bahwa proses sedang berlangsung
        await sock.sendMessage(remoteJid, {
            text: `⏳ *Proses penambahan tag*\n\nSedang menambahkan nomor ${customerNumber} ke perangkat ${deviceId}...`
        });
        
        // Persiapkan URL untuk menambahkan tag
        const tagUrl = `${genieacsUrl}/devices/${deviceId}/tags/${customerNumber}`;
        
        // Kirim request ke GenieACS untuk menambahkan tag
        try {
            const response = await axios.post(
                tagUrl,
                {},
                {
                    auth: {
                        username: global.appSettings.genieacsUsername || process.env.GENIEACS_USERNAME,
                        password: global.appSettings.genieacsPassword || process.env.GENIEACS_PASSWORD
                    }
                }
            );
            
            logger.info(`Tag response: ${response.status}`);
            
            // Kirim pesan sukses
            let successMessage = `✅ *Tag berhasil ditambahkan*\n\n`;
            successMessage += `📱 *Nomor Pelanggan:* ${customerNumber}\n`;
            successMessage += `👤 *PPPoE Username:* ${pppoeUsername}\n`;
            successMessage += `🖥️ *Device ID:* ${deviceId}\n\n`;
            successMessage += `Pelanggan sekarang dapat menggunakan WhatsApp dan Web Portal dengan nomor tersebut.`;
            
            await sock.sendMessage(remoteJid, { text: successMessage });
            
        } catch (error) {
            logger.error('Error adding tag to GenieACS:', error);
            
            let errorMessage = `❌ *Gagal menambahkan tag*\n\n`;
            if (error.response) {
                errorMessage += `Status: ${error.response.status}\n`;
                errorMessage += `Pesan: ${JSON.stringify(error.response.data)}\n`;
            } else {
                errorMessage += `Error: ${error.message}\n`;
            }
            
            await sock.sendMessage(remoteJid, { text: errorMessage });
        }
        
    } catch (error) {
        logger.error('Error in addTagByPPPoE:', error);
        
        await sock.sendMessage(remoteJid, {
            text: `❌ *Error*\n\nTerjadi kesalahan saat menambahkan tag: ${error.message}`
        });
    }
}

// Fungsi untuk mencari perangkat berdasarkan PPPoE Username
async function findDeviceByPPPoE(pppoeUsername) {
    try {
        // Dapatkan URL GenieACS
        const genieacsUrl = global.appSettings.genieacsUrl || process.env.GENIEACS_URL;
        if (!genieacsUrl) {
            logger.error('GenieACS URL not configured');
            return null;
        }
        
        // Parameter paths untuk PPPoE Username
        const pppUsernamePaths = [
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username._value',
            'VirtualParameters.pppoeUsername',
            'VirtualParameters.pppUsername'
        ];
        
        // Buat query untuk mencari perangkat berdasarkan PPPoE Username
        // Kita perlu membuat query yang mencari di semua kemungkinan path
        const queryObj = { $or: [] };
        
        // Tambahkan semua kemungkinan path ke query
        for (const path of pppUsernamePaths) {
            const pathQuery = {};
            pathQuery[path] = pppoeUsername;
            queryObj.$or.push(pathQuery);
        }
        
        const queryJson = JSON.stringify(queryObj);
        const encodedQuery = encodeURIComponent(queryJson);
        
        // Ambil perangkat dari GenieACS
        const response = await axios.get(`${genieacsUrl}/devices/?query=${encodedQuery}`, {
            auth: {
                username: global.appSettings.genieacsUsername || process.env.GENIEACS_USERNAME,
                password: global.appSettings.genieacsPassword || process.env.GENIEACS_PASSWORD
            },
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.data && response.data.length > 0) {
            return response.data[0];
        }
        
        return null;
    } catch (error) {
        logger.error(`Error finding device by PPPoE Username: ${error.message}`);
        return null;
    }
}

module.exports = {
    setSock,
    addCustomerTag,
    findDeviceById,
    addTagByPPPoE
};
