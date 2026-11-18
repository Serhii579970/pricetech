let products = [
  {id:1,name:"Молоко 2,5%",brand:"900 мл · Молочні",category:"Молочні",emoji:"🥛",price:34.90,old:39.90,store:"Супермаркет «Свіжий»",deal:"−13%"},
  {id:2,name:"Кава мелена",brand:"250 г · Напої",category:"Напої",emoji:"☕",price:129.00,old:149.00,store:"Маркет «Поруч»",deal:"−13%"},
  {id:3,name:"Яйця курячі",brand:"10 шт. · Інше",category:"Інше",emoji:"🥚",price:49.90,old:null,store:"Міський маркет",deal:"Вигідно"},
  {id:4,name:"Макарони",brand:"400 г · Бакалія",category:"Бакалія",emoji:"🍝",price:32.50,old:36.00,store:"Супермаркет «Свіжий»",deal:"−10%"},
  {id:5,name:"Йогурт натуральний",brand:"300 г · Молочні",category:"Молочні",emoji:"🥣",price:28.90,old:null,store:"Маркет «Поруч»",deal:"Хіт"},
  {id:6,name:"Яблука",brand:"1 кг · Інше",category:"Інше",emoji:"🍎",price:39.00,old:45.00,store:"Міський маркет",deal:"−13%"},
  {id:7,name:"Сік яблучний",brand:"1 л · Напої",category:"Напої",emoji:"🧃",price:54.90,old:null,store:"Супермаркет «Свіжий»",deal:"Новинка"},
  {id:8,name:"Рис довгозернистий",brand:"800 г · Бакалія",category:"Бакалія",emoji:"🍚",price:44.50,old:49.90,store:"Маркет «Поруч»",deal:"−11%"}
];
let shoppingList = [];
const grid = document.querySelector("#product-grid");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const sortSelect = document.querySelector("#sort-select");
const toast = document.querySelector("#toast");

function money(value){ return value.toLocaleString("uk-UA",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₴"; }
function notify(message){
  toast.textContent=message; toast.classList.add("show");
  clearTimeout(notify.timer); notify.timer=setTimeout(()=>toast.classList.remove("show"),2400);
}
function renderProducts(){
  const query=searchInput.value.trim().toLocaleLowerCase("uk");
  const category=categoryFilter.value;
  let shown=products.filter(p=>(p.name+" "+p.brand+" "+p.category).toLocaleLowerCase("uk").includes(query)&&(category==="all"||p.category===category));
  if(sortSelect.value==="price") shown.sort((a,b)=>a.price-b.price);
  if(sortSelect.value==="name") shown.sort((a,b)=>a.name.localeCompare(b.name,"uk"));
  grid.innerHTML="";
  if(!shown.length){grid.innerHTML='<div class="empty-state"><strong>Нічого не знайдено</strong><p>Спробуй іншу назву або зміни фільтр.</p></div>';return;}
  shown.forEach(p=>{
    const card=document.createElement("article");card.className="product-card";
    card.innerHTML=`<div class="product-image${p.image?" has-photo":""}"><span class="deal">${p.deal}</span><button class="heart" aria-label="Додати в обране" title="Демо-обране">♡</button>${p.image?`<img src="${p.image}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.remove('has-photo');this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${p.emoji}'}))">`:`<span>${p.emoji}</span>`}</div>
      <div class="product-body"><p class="product-category">${p.brand}</p><h3>${p.link?`<a class="product-link" href="${p.link}" target="_blank" rel="noopener noreferrer">${p.name}</a>`:p.name}</h3><div class="price-row"><strong>${money(p.price)}</strong>${p.old?`<del>${money(p.old)}</del>`:""}</div><p class="store-caption">▣ ${p.store}</p><button class="add-button" data-add="${p.id}">＋ Додати до списку</button></div>`;
    grid.appendChild(card);
  });
}
function renderList(){
  const list=document.querySelector("#shopping-list");
  const total=shoppingList.reduce((sum,item)=>sum+item.price*item.qty,0);
  document.querySelector("#list-total").textContent=money(total);
  document.querySelector("#list-count").textContent=`${shoppingList.reduce((s,i)=>s+i.qty,0)} товарів`;
  document.querySelector("#nav-count").textContent=shoppingList.reduce((s,i)=>s+i.qty,0);
  if(!shoppingList.length){list.innerHTML='<div class="empty-state"><span>☷</span><strong>Список поки порожній</strong><p>Додай товари з карток вище.</p></div>';return;}
  list.innerHTML="";
  shoppingList.forEach(item=>{
    const row=document.createElement("div");row.className="shopping-item";
    row.innerHTML=`<span class="shopping-emoji">${item.emoji}</span><span class="item-name">${item.name}<small>${item.qty} × ${money(item.price)}${item.gone?" · немає в каталозі":""}</small></span><strong>${money(item.qty*item.price)}</strong><button class="remove-item" data-remove="${item.id}" aria-label="Видалити ${item.name}">×</button>`;
    list.appendChild(row);
  });
}
grid.addEventListener("click",e=>{
  const add=e.target.closest("[data-add]");
  const heart=e.target.closest(".heart");
  if(heart){heart.textContent=heart.textContent==="♡"?"♥":"♡";notify("Обране у цьому демо працює лише в межах сторінки.");}
  if(!add)return;
  const product=products.find(p=>p.id===Number(add.dataset.add));
  const existing=shoppingList.find(p=>p.id===product.id);
  if(existing)existing.qty++;else shoppingList.push({...product,qty:1});
  renderList();notify(`${product.name} додано до списку`);
});
document.querySelector("#shopping-list").addEventListener("click",e=>{
  const remove=e.target.closest("[data-remove]");if(!remove)return;
  shoppingList=shoppingList.filter(p=>p.id!==Number(remove.dataset.remove));renderList();notify("Товар видалено зі списку");
});
document.querySelector("#search-form").addEventListener("submit",e=>{e.preventDefault();renderProducts();document.querySelector("#products").scrollIntoView({behavior:"smooth"});});
document.querySelectorAll("[data-query]").forEach(button=>button.addEventListener("click",()=>{searchInput.value=button.dataset.query;categoryFilter.value="all";renderProducts();document.querySelector("#products").scrollIntoView({behavior:"smooth"});}));
categoryFilter.addEventListener("change",renderProducts);
sortSelect.addEventListener("change",renderProducts);
document.querySelector("#optimize-button").addEventListener("click",()=>{
  const result=document.querySelector("#optimization-result");
  if(!shoppingList.length){notify("Спочатку додай товари до списку покупок.");return;}
  const total=shoppingList.reduce((sum,item)=>sum+item.price*item.qty,0);
  const saving=total*0.08;
  result.hidden=false;
  result.innerHTML=`<strong>Демо-оптимізація готова!</strong><br>Один магазин: ${money(total)}<br>Приклад розподілу між магазинами: потенційна економія близько ${money(saving)}.<br><small>Це умовний розрахунок. Реальні ціни, маршрути та час потребуватимуть актуальних даних і окремого алгоритму.</small>`;
  notify("Сформовано демонстраційне порівняння");
});
document.querySelectorAll(".nav-link").forEach(link=>link.addEventListener("click",()=>{
  document.querySelectorAll(".nav-link").forEach(n=>n.classList.remove("active"));link.classList.add("active");
}));

function syncCategories(){
  const cats=[...new Set(products.map(p=>p.category))];
  categoryFilter.innerHTML='<option value="all">Усі категорії</option>'+cats.map(c=>`<option value="${c}">${c}</option>`).join("");
}
let lastUpdated=null;
function syncList(){
  let changed=0,gone=0;
  shoppingList.forEach(item=>{
    const p=products.find(x=>x.id===item.id);
    if(!p){if(!item.gone)gone++;item.gone=true;return;}
    if(p.price!==item.price)changed++;
    Object.assign(item,p,{qty:item.qty,gone:false});
  });
  renderList();
  if(changed)notify(`Оновлено ціни у списку: ${changed}`);
  else if(gone)notify(`Товарів, яких вже немає в каталозі: ${gone}`);
}
async function loadProducts(){
  try{
    const r=await fetch("/api/products",{cache:"no-store"});
    if(!r.ok)throw new Error(r.status);
    const data=await r.json();
    if(Array.isArray(data.products)&&data.products.length&&data.updated!==lastUpdated){
      lastUpdated=data.updated;products=data.products;
      const current=categoryFilter.value;
      syncCategories();
      if([...categoryFilter.options].some(o=>o.value===current))categoryFilter.value=current;
      const note=document.querySelector(".data-note");
      if(note)note.textContent=`* Дані: ${data.source}. Оновлено ${new Date(data.updated).toLocaleString("uk-UA")}.`;
      syncList();
    }
    loadProducts.fails=0;
  }catch(e){
    console.warn("API недоступне, показано демо-дані",e);
    // Сервер міг ще не закінчити перше оновлення (503) — пробуємо знову через кілька секунд
    loadProducts.fails=(loadProducts.fails||0)+1;
    const note=document.querySelector(".data-note");
    if(note)note.textContent="* Дані ще завантажуються з сервера… показано демо-товари.";
    clearTimeout(loadProducts.retry);
    loadProducts.retry=setTimeout(loadProducts,Math.min(5000*loadProducts.fails,30000));
  }
  renderProducts();
}
renderList();loadProducts();
setInterval(loadProducts,10*60*1000);
