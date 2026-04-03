const express = require('express');
const axios = require('axios');
const { getSettingsWithCache } = require('../config/settingsManager');
const router = express.Router();

// ─── Helper: Cari perangkat di GenieACS berdasarkan tag pelanggan ───────────
// Digunakan untuk validasi login — hanya ambil _id dan _tags (efisien)
async function findDeviceByTag(phone) {
  const settings = getSettingsWithCache();
  const genieacsUrl = settings.genieacs_url || 'http://localhost:7557';
  const username = settings.genieacs_username || '';
  const password = settings.genieacs_password || '';
  try {
    const response = await axios.get(`${genieacsUrl}/devices`, {
      params: {
        query: JSON.stringify({ _tags: phone }),
        projection: '_id,_tags'  // Hanya ambil field yang diperlukan, bukan seluruh data device
      },
      auth: { username, password },
      timeout: 10000  // Timeout 10 detik agar tidak hang
    });
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ─── Helper: Ambil data LENGKAP perangkat (untuk dashboard) ─────────────────
// Berbeda dengan findDeviceByTag, fungsi ini mengambil semua field
async function fetchFullDevice(phone) {
  const settings = getSettingsWithCache();
  const genieacsUrl = settings.genieacs_url || 'http://localhost:7557';
  const username = settings.genieacs_username || '';
  const password = settings.genieacs_password || '';
  try {
    const response = await axios.get(`${genieacsUrl}/devices`, {
      params: { query: JSON.stringify({ _tags: phone }) },
      auth: { username, password },
      timeout: 15000
    });
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ─── Mapping parameter paths dari GenieACS ──────────────────────────────────
const parameterPaths = {
  rxPower: [
    'VirtualParameters.RXPower',
    'VirtualParameters.redaman',
    'InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower'
  ],
  pppoeIP: [
    'VirtualParameters.pppoeIP',
    'VirtualParameters.pppIP',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress'
  ],
  pppUsername: [
    'VirtualParameters.pppoeUsername',
    'VirtualParameters.pppUsername',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username'
  ],
  uptime: [
    'VirtualParameters.getdeviceuptime',
    'InternetGatewayDevice.DeviceInfo.UpTime'
  ],
  userConnected: [
    'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations'
  ]
};

function getParameterWithPaths(device, paths) {
  for (const p of paths) {
    const parts = p.split('.');
    let value = device;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
        if (value && value._value !== undefined) value = value._value;
      } else {
        value = undefined;
        break;
      }
    }
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return 'N/A';
}

// ─── Helper: Ambil data lengkap perangkat pelanggan ─────────────────────────
async function getCustomerDeviceData(phone) {
  const device = await fetchFullDevice(phone);  // Gunakan fetchFullDevice untuk data lengkap
  if (!device) return null;

  const ssid = device?.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration?.['1']?.SSID?._value || '-';

  const lastInform =
    device?._lastInform
      ? new Date(device._lastInform).toLocaleString('id-ID')
      : device?.Events?.Inform
        ? new Date(device.Events.Inform).toLocaleString('id-ID')
        : device?.InternetGatewayDevice?.DeviceInfo?.['1']?.LastInform?._value
          ? new Date(device.InternetGatewayDevice.DeviceInfo['1'].LastInform._value).toLocaleString('id-ID')
          : '-';

  // FIX BUG #2: Status berdasarkan selisih waktu lastInform dengan sekarang
  // Jika lastInform dalam 15 menit terakhir -> Online, jika lebih -> Offline, jika tidak ada -> Unknown
  let status = 'Unknown';
  if (device?._lastInform) {
    const diffMs = Date.now() - new Date(device._lastInform).getTime();
    status = diffMs < 15 * 60 * 1000 ? 'Online' : 'Offline';
  } else if (device?.Events?.Inform) {
    const diffMs = Date.now() - new Date(device.Events.Inform).getTime();
    status = diffMs < 15 * 60 * 1000 ? 'Online' : 'Offline';
  }

  let connectedUsers = [];
  try {
    const hosts = device?.InternetGatewayDevice?.LANDevice?.['1']?.Hosts?.Host;
    if (hosts && typeof hosts === 'object') {
      for (const key in hosts) {
        if (!isNaN(key)) {
          const entry = hosts[key];
          connectedUsers.push({
            hostname: typeof entry?.HostName === 'object' ? entry?.HostName?._value || '-' : entry?.HostName || '-',
            ip:       typeof entry?.IPAddress === 'object' ? entry?.IPAddress?._value || '-' : entry?.IPAddress || '-',
            mac:      typeof entry?.MACAddress === 'object' ? entry?.MACAddress?._value || '-' : entry?.MACAddress || '-',
            iface:    typeof entry?.InterfaceType === 'object' ? entry?.InterfaceType?._value || '-' : entry?.InterfaceType || entry?.Interface || '-',
            status:   entry?.Active?._value === 'true' ? 'Online' : 'Offline'
          });
        }
      }
    }
  } catch (e) {}

  const rxPower        = getParameterWithPaths(device, parameterPaths.rxPower);
  const pppoeIP        = getParameterWithPaths(device, parameterPaths.pppoeIP);
  const pppoeUsername  = getParameterWithPaths(device, parameterPaths.pppUsername);
  const uptimeRaw      = getParameterWithPaths(device, parameterPaths.uptime);
  const totalAssociations = getParameterWithPaths(device, parameterPaths.userConnected);

  // Format uptime dari detik ke format hari/jam/menit
  function formatUptime(seconds) {
    if (!seconds || isNaN(seconds) || seconds === 'N/A') return seconds || 'N/A';
    const s = parseInt(seconds);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}h ${h}j ${m}m`;
    if (h > 0) return `${h}j ${m}m`;
    return `${m}m`;
  }
  const uptime = formatUptime(uptimeRaw);

  const serialNumber   = device?.DeviceID?.SerialNumber || device?.InternetGatewayDevice?.DeviceInfo?.SerialNumber?._value || '-';
  const productClass   = device?.DeviceID?.ProductClass || device?.InternetGatewayDevice?.DeviceInfo?.ProductClass?._value || '-';
  const softwareVersion = device?.InternetGatewayDevice?.DeviceInfo?.SoftwareVersion?._value || '-';
  const model          = device?.InternetGatewayDevice?.DeviceInfo?.ModelName?._value || device?.ModelName || '-';

  // FIX BUG #1: GenieACS REST API mengembalikan field "_tags", bukan "Tags"
  let lokasi = device?._tags || '-';
  if (Array.isArray(lokasi)) lokasi = lokasi.join(', ');

  return {
    phone, ssid, status, lastInform, connectedUsers,
    rxPower, pppoeIP, pppoeUsername,
    serialNumber, productClass, lokasi, softwareVersion, model,
    uptime, totalAssociations
  };
}

// ─── Helper: Objek fallback lengkap agar EJS tidak crash ────────────────────
function fallbackCustomer(phone) {
  return {
    phone,
    ssid: '-', status: 'Tidak ditemukan', lastInform: '-',
    connectedUsers: [],
    rxPower: '-', pppoeIP: '-', pppoeUsername: '-',
    serialNumber: '-', productClass: '-', lokasi: '-',
    softwareVersion: '-', model: '-',
    uptime: '-', totalAssociations: '-'
  };
}

// ─── Helper: Update SSID ke GenieACS ────────────────────────────────────────
async function updateSSID(phone, newSSID) {
  try {
    const device = await findDeviceByTag(phone);
    if (!device) return false;
    const deviceId = encodeURIComponent(device._id);
    const settings = getSettingsWithCache();
    const genieacsUrl = settings.genieacs_url || 'http://localhost:7557';
    const auth = { username: settings.genieacs_username || '', password: settings.genieacs_password || '' };

    await axios.post(`${genieacsUrl}/devices/${deviceId}/tasks`, {
      name: 'setParameterValues',
      parameterValues: [['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', newSSID, 'xsd:string']]
    }, { auth });

    const newSSID5G = `${newSSID}-5G`;
    for (const idx of [5, 6, 7, 8]) {
      try {
        await axios.post(`${genieacsUrl}/devices/${deviceId}/tasks`, {
          name: 'setParameterValues',
          parameterValues: [[`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx}.SSID`, newSSID5G, 'xsd:string']]
        }, { auth });
        break;
      } catch (e) {}
    }

    await axios.post(`${genieacsUrl}/devices/${deviceId}/tasks`, {
      name: 'refreshObject',
      objectName: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration'
    }, { auth });

    return true;
  } catch (e) {
    return false;
  }
}

// ─── Helper: Update Password WiFi ke GenieACS ───────────────────────────────
async function updatePassword(phone, newPassword) {
  try {
    if (newPassword.length < 8) return false;
    const device = await findDeviceByTag(phone);
    if (!device) return false;
    const deviceId = encodeURIComponent(device._id);
    const settings = getSettingsWithCache();
    const genieacsUrl = settings.genieacs_url || 'http://localhost:7557';
    const auth = { username: settings.genieacs_username || '', password: settings.genieacs_password || '' };
    const tasksUrl = `${genieacsUrl}/devices/${deviceId}/tasks`;

    // Update password 2.4GHz (index 1)
    await axios.post(tasksUrl, {
      name: 'setParameterValues',
      parameterValues: [
        ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase', newPassword, 'xsd:string'],
        ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase', newPassword, 'xsd:string']
      ]
    }, { auth });

    // FIX BUG #5: Update password 5GHz dengan retry index 5-8 (sama seperti SSID)
    for (const idx of [5, 6, 7, 8]) {
      try {
        await axios.post(tasksUrl, {
          name: 'setParameterValues',
          parameterValues: [
            [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx}.KeyPassphrase`, newPassword, 'xsd:string'],
            [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx}.PreSharedKey.1.KeyPassphrase`, newPassword, 'xsd:string']
          ]
        }, { auth });
        break; // Berhenti setelah berhasil
      } catch (e) {}
    }

    await axios.post(tasksUrl, {
      name: 'refreshObject',
      objectName: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration'
    }, { auth });

    return true;
  } catch (e) {
    return false;
  }
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// GET: Halaman login
router.get('/login', (req, res) => {
  const settings = getSettingsWithCache();
  res.render('login', { error: null, settings });
});

// POST: Proses login — langsung ke dashboard tanpa OTP
router.post('/login', async (req, res) => {
  const { phone } = req.body;
  const settings = getSettingsWithCache();
  if (!await findDeviceByTag(phone)) {
    return res.render('login', { error: 'ID/Tag tidak valid atau belum terdaftar.', settings });
  }
  req.session.phone = phone;
  return res.redirect('/customer/dashboard');
});

// GET: Dashboard pelanggan
router.get('/dashboard', async (req, res) => {
  const phone = req.session && req.session.phone;
  if (!phone) return res.redirect('/customer/login');
  const data = await getCustomerDeviceData(phone);
  res.render('dashboard', {
    customer: data || fallbackCustomer(phone),
    connectedUsers: data ? data.connectedUsers : [],
    notif: data ? null : 'Data perangkat tidak ditemukan.'
  });
});

// POST: Ganti SSID
router.post('/change-ssid', async (req, res) => {
  const phone = req.session && req.session.phone;
  if (!phone) return res.redirect('/customer/login');
  const { ssid } = req.body;
  const ok = await updateSSID(phone, ssid);
  const data = await getCustomerDeviceData(phone);
  res.render('dashboard', {
    customer: data || fallbackCustomer(phone),
    connectedUsers: data ? data.connectedUsers : [],
    notif: ok ? 'Nama WiFi (SSID) berhasil diubah.' : 'Gagal mengubah SSID.'
  });
});

// POST: Ganti Password WiFi
router.post('/change-password', async (req, res) => {
  const phone = req.session && req.session.phone;
  if (!phone) return res.redirect('/customer/login');
  const { password } = req.body;
  const ok = await updatePassword(phone, password);
  const data = await getCustomerDeviceData(phone);
  res.render('dashboard', {
    customer: data || fallbackCustomer(phone),
    connectedUsers: data ? data.connectedUsers : [],
    notif: ok ? 'Password WiFi berhasil diubah.' : 'Gagal mengubah password. Pastikan minimal 8 karakter.'
  });
});

// POST: Reboot perangkat
router.post('/reboot', async (req, res) => {
  const phone = req.session && req.session.phone;
  if (!phone) return res.redirect('/customer/login');
  const device = await findDeviceByTag(phone);
  let notif = '';
  if (device && device._id) {
    const settings = getSettingsWithCache();
    const genieacsUrl = settings.genieacs_url || 'http://localhost:7557';
    const auth = { username: settings.genieacs_username || '', password: settings.genieacs_password || '' };
    try {
      await axios.post(
        `${genieacsUrl}/devices/${encodeURIComponent(device._id)}/tasks`,
        { name: 'reboot', timestamp: new Date().toISOString() },
        { auth }
      );
      notif = 'Perangkat berhasil direboot. Silakan tunggu beberapa menit hingga perangkat online kembali.';
    } catch (e) {
      notif = 'Gagal mengirim perintah reboot ke perangkat.';
    }
  } else {
    notif = 'Perangkat tidak ditemukan.';
  }
  const data = await getCustomerDeviceData(phone);
  res.render('dashboard', {
    customer: data || fallbackCustomer(phone),
    connectedUsers: data ? data.connectedUsers : [],
    notif
  });
});

// POST: Ubah ID/Tag pelanggan
router.post('/change-tag', async (req, res) => {
  const oldTag = req.session && req.session.phone;
  const newTag = (req.body.newTag || '').trim();
  if (!oldTag) return res.redirect('/customer/login');
  if (!newTag || newTag === oldTag) {
    const data = await getCustomerDeviceData(oldTag);
    return res.render('dashboard', {
      customer: data || fallbackCustomer(oldTag),
      connectedUsers: data ? data.connectedUsers : [],
      notif: 'ID/Tag baru tidak boleh kosong atau sama dengan yang lama.'
    });
  }
  const device = await findDeviceByTag(oldTag);
  let notif = '';
  if (device && device._id) {
    const settings = getSettingsWithCache();
    const genieacsUrl = settings.genieacs_url || 'http://localhost:7557';
    const auth = { username: settings.genieacs_username || '', password: settings.genieacs_password || '' };
    try {
      // FIX BUG #3: GenieACS REST API menggunakan "_tags", bukan "Tags"
      const tags = Array.isArray(device._tags) ? device._tags.filter(t => t !== oldTag) : [];
      tags.push(newTag);
      await axios.put(
        `${genieacsUrl}/devices/${encodeURIComponent(device._id)}`,
        { _id: device._id, _tags: tags },
        { auth }
      );
      req.session.phone = newTag;
      notif = 'ID/Tag berhasil diubah.';
    } catch (e) {
      notif = 'Gagal mengubah ID/Tag pelanggan.';
    }
  } else {
    notif = 'Perangkat tidak ditemukan.';
  }
  const resolvedPhone = notif === 'ID/Tag berhasil diubah.' ? newTag : oldTag;
  const data = await getCustomerDeviceData(resolvedPhone);
  res.render('dashboard', {
    customer: data || fallbackCustomer(resolvedPhone),
    connectedUsers: data ? data.connectedUsers : [],
    notif
  });
});

// POST: Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/customer/login');
  });
});

module.exports = router;