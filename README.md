## Tampilan
<img width="1358" height="650" alt="Image" src="https://github.com/user-attachments/assets/d2689a26-9eed-4449-a0d3-2edffddd7bc6" />
<img width="1358" height="650" alt="Image" src="https://github.com/user-attachments/assets/c13ed312-d007-4cc2-987d-e82f171dd7ce" />
<img width="1358" height="650" alt="Image" src="https://github.com/user-attachments/assets/fdf7acae-cd32-404d-a50e-d77b59156ea5" />
<img width="1358" height="650" alt="Image" src="https://github.com/user-attachments/assets/2d530df8-beb3-493e-ad04-8bafbc39ad3f" />
# INSTALL GENIEACS OTOMATIS
This is autoinstall GenieACS 

# Usage
```
apt install git curl -y
```
```
git clone https://github.com/alijayanet/genieacs
```
```
cd genieacs
```
```
chmod +x *.sh
```
INSTALL GENIEACS DARKMODE Ubuntu OS 22.04
```
bash darkmode.sh
```
INSTALL GENIEACS DARKMODE ARMBIAN (STB)
```
bash darkmode.sh
```
INSTALL GENIEACS THEMA ORIGINAL v@1.2.13
```
bash install.sh
```

Baca terlebih dahulu !!!

#=== Script update GenieACS ====#

Config sebelumnya akan terhapus dan tergantikan oleh config baru

Yang akan diupdate, yaitu:

   • Admin >> Preset <br>
   • Admin >> Provosions <br>
   • Admin >> Virtual Parameter<br>
   • Admin >> Config<br>
   
#===Script/config tersebut akan terganti dengan yang baru ====#

Jika anda memiliki config/script custom buatan anda sendiri,<br> 
silahkan backup terlebih dahulu, kemudian setelah update lakukan config manual lagi sesuai config custom anda.<br>

Akses GenieACS

Web UI: http://localhost:3000
Username: admin
Password: admin (menu virtualparameter dll di sembunyikan)<br>
API: http://localhost:7557 <br>
CWMP (TR-069): http://your-server-ip:7547<br>

======= CARA RESTORE ========<br>
```
cd
```
```
sudo mongorestore --db=genieacs --drop genieacs-backup/genieacs
```
🤝 Kontribusi
Kontribusi selalu diterima! Silakan buat pull request atau laporkan issue jika menemukan bug.

https://wa.me/6281947215703

atau link group telegram

https://t.me/alijayaNetAcs

SILAHKAN YANG INGIN BERBAGI UANG KOPI <br>
https://paypal.me/warnetalijayaID

![Image](https://github.com/user-attachments/assets/724e5ac2-626e-4f2d-bd1f-1265b70b544f)
