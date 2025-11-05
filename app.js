// app.js
const CONTRACT_ADDRESS = "PUT_YOUR_DEPLOYED_CONTRACT_ADDRESS_HERE"; // <-- deploy แล้ววางที่นี่
const ABI = [
  // minimal ABI: floatKrathong + getters + events
  "function floatKrathong(uint8,string) payable",
  "function totalBurned() view returns (uint256)",
  "function totalFees() view returns (uint256)",
  "function totalTx() view returns (uint256)",
  "function getKrathongCount() view returns (uint256)",
  "function getKrathong(uint256) view returns (address,uint256,uint256,uint256,uint8,string)",
  "event KrathongFloated(address indexed user, uint256 amount, uint256 fee, uint8 designId, string wish)"
];

let provider, signer, contract;

const designs = [
  {id:0, title:"กระทงกล้วย", img:"https://i.imgur.com/3cX9f0g.png"},
  {id:1, title:"กระทงดอกไม้", img:"https://i.imgur.com/5QF0k9P.png"},
  {id:2, title:"กระทงแมวน้อย", img:"https://i.imgur.com/2Kc8p6r.png"},
  {id:3, title:"กระทงกระดาษ", img:"https://i.imgur.com/9k2B7yF.png"},
];

async function init(){
  // render design cards
  const droot = document.getElementById('designs');
  designs.forEach(d=>{
    const el = document.createElement('div');
    el.className = 'design-card';
    el.dataset.id = d.id;
    el.innerHTML = `<img src="${d.img}" alt="${d.title}"><div style="position:absolute;bottom:6px;font-size:11px">${d.title}</div>`;
    el.onclick = ()=>{ document.querySelectorAll('.design-card').forEach(c=>c.classList.remove('selected')); el.classList.add('selected') };
    droot.appendChild(el);
  });

  document.getElementById('connectBtn').addEventListener('click', connectWallet);
  document.getElementById('floatBtn').addEventListener('click', floatKrathong);

  // network notice (instructions)
  document.getElementById('networkNotice').innerHTML = `หากยังไม่ได้เพิ่มเครือข่าย KUB ใน MetaMask ให้เพิ่มด้วย RPC และ Chain ID (Testnet: rpc-testnet.bitkubchain.io Chain ID 25925).`;
}

async function connectWallet(){
  if (!window.ethereum) return alert("ติดตั้ง MetaMask ก่อน");
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  const addr = await signer.getAddress();
  document.getElementById('addr').innerText = `ที่อยู่: ${addr}`;
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  // show balance
  const bal = await provider.getBalance(addr);
  document.getElementById('balance').innerText = `ยอดเงิน: ${ethers.formatEther(bal)} KUB`;

  // load stats
  await refreshStats();
  await loadKrathongs();

  // listen to events
  contract.on?.("KrathongFloated", (...args) => {
    // simple refresh
    setTimeout(()=>{ refreshStats(); loadKrathongs(); }, 1200);
  });
}

async function floatKrathong(){
  if (!signer) return alert("เชื่อมต่อ MetaMask ก่อน");
  const amtStr = document.getElementById('amount').value;
  const wish = document.getElementById('wish').value || "";
  const selected = document.querySelector('.design-card.selected');
  const designId = selected ? Number(selected.dataset.id) : 0;
  if (!amtStr || Number(amtStr) <= 0) return alert("ใส่จำนวน KUB ที่ต้องการหยอด");

  const value = ethers.parseEther(String(amtStr)); // wei
  try {
    const tx = await contract.floatKrathong(designId, wish, { value });
    alert("ส่งธุรกรรมแล้ว รอสักครู่เพื่อยืนยัน...");
    await tx.wait();
    alert("ลอยกระทงสำเร็จ 🎉");
    // refresh UI
    await refreshStats();
    await loadKrathongs();
  } catch (e) {
    console.error(e);
    alert("เกิดข้อผิดพลาด: " + (e?.reason || e?.message || e));
  }
}

async function refreshStats(){
  if (!contract) return;
  const tb = await contract.totalBurned();
  const tf = await contract.totalFees();
  const tt = await contract.totalTx();
  document.getElementById('totalBurned').innerText = ethers.formatEther(tb);
  document.getElementById('totalFees').innerText = ethers.formatEther(tf);
  document.getElementById('totalTx').innerText = tt.toString();
}

async function loadKrathongs(){
  if (!contract) return;
  const count = (await contract.getKrathongCount()).toString();
  const list = document.getElementById('krathongList');
  list.innerHTML = '';
  const n = Number(count) > 50 ? 50 : Number(count); // limit to avoid UI overflow
  for (let i = Math.max(0, Number(count)-n); i < Number(count); i++){
    const k = await contract.getKrathong(i);
    // k = [user,address,uint256 amount,uint256 fee,uint256 timestamp,uint8 designId,string wish] per ABI mapping
    const user = k[0];
    const amount = ethers.formatEther(k[1]);
    const fee = ethers.formatEther(k[2]);
    const ts = new Date(Number(k[3])*1000).toLocaleString();
    const designId = Number(k[4]) || 0;
    const wish = k[5];

    const el = document.createElement('div');
    el.className = 'krathong';
    el.innerHTML = `
      <div><strong>${designs[designId]?.title || 'กระทง'}</strong></div>
      <div class="wish">${escapeHtml(wish)}</div>
      <small>จาก: ${shortAddr(user)} • ยอด: ${amount} KUB • ค่าธรรมเนียม: ${fee} • ${ts}</small>
    `;
    list.prepend(el);
  }
}

function shortAddr(a){ return a ? (a.slice(0,6) + "..." + a.slice(-4)) : ""; }
function escapeHtml(s){ return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;") }

init();
