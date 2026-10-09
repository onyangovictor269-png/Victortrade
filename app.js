const $=id=>document.getElementById(id);
let ws=null,prices=[],demo=false,demoTimer=null,activeTrade=null,journal=[],balance=1000,pnl=0,wins=0,losses=0,consecutive=0,trades=0;
function ema(a,n){let k=2/(n+1),e=a[0];for(let i=1;i<a.length;i++)e=a[i]*k+e*(1-k);return e}
function rsi(a,n=14){if(a.length<n+1)return 50;let g=0,l=0;for(let i=a.length-n;i<a.length;i++){let d=a[i]-a[i-1];if(d>0)g+=d;else l-=d}if(l===0)return 100;return 100-100/(1+g/l)}
function draw(){let c=$("chart"),x=c.getContext("2d"),w=c.width=c.clientWidth*devicePixelRatio,h=c.height=c.clientHeight*devicePixelRatio;x.clearRect(0,0,w,h);if(prices.length<2)return;let min=Math.min(...prices),max=Math.max(...prices),pad=12;x.beginPath();prices.forEach((p,i)=>{let px=pad+i*(w-2*pad)/(prices.length-1),py=h-pad-(p-min)/(max-min||1)*(h-2*pad);i?x.lineTo(px,py):x.moveTo(px,py)});x.strokeStyle="#60a5fa";x.lineWidth=2*devicePixelRatio;x.stroke()}
function analyze(){if(prices.length<30)return null;let e9=ema(prices.slice(-80),9),e21=ema(prices.slice(-80),21),r=rsi(prices,14),m=prices[prices.length-1]/prices[Math.max(0,prices.length-6)]-1;let up=(e9>e21?35:0)+(r>52?25:0)+(m>0?25:0),down=(e9<e21?35:0)+(r<48?25:0)+(m<0?25:0),score=Math.max(up,down),sig=score>=70?(up>down?"UP":"DOWN"):"WAIT";$("signal").textContent=sig;$("confidence").textContent=Math.round(score)+"%";$("reason").textContent=sig==="WAIT"?"Conditions not strong enough":"EMA, RSI and momentum alignment";$("signal").style.color=sig==="UP"?"#34d399":sig==="DOWN"?"#fb7185":"#fbbf24";return {sig,score,entry:prices[prices.length-1]}}
function start(){stop();let symbol=$("symbol").value,count=+$("count").value;ws=new WebSocket("wss://api.derivws.com/trading/v1/options/ws/public");$("status").textContent="CONNECTING";ws.onopen=()=>{$("status").textContent="LIVE";ws.send(JSON.stringify({ticks_history:symbol,count:Math.min(count,500),end:"latest",style:"ticks"}));ws.send(JSON.stringify({ticks:symbol,subscribe:1}))};ws.onmessage=e=>{let m=JSON.parse(e.data);if(m.history){prices=m.history.prices.map(Number).slice(-500);draw();analyze()}if(m.tick){prices.push(Number(m.tick.quote));prices=prices.slice(-500);$("price").textContent=Number(m.tick.quote).toFixed(5);$("updated").textContent=new Date().toLocaleTimeString();draw();let sig=analyze();if(demo&&!activeTrade)scheduleTrade(sig)}};ws.onerror=()=>$("status").textContent="ERROR";ws.onclose=()=>$("status").textContent="DISCONNECTED";$("start").disabled=true;$("stop").disabled=false}
function stop(){if(ws){ws.close();ws=null}$("start").disabled=false;$("stop").disabled=true}
function limitsReached(){let max=+$("maxTrades").value,maxLoss=+$("maxLoss").value,maxC=+$("maxConsecutive").value;if(trades>=max||pnl<=-maxLoss||consecutive>=max){$("riskState").textContent="Risk guard: STOPPED";return true}return false}
function scheduleTrade(sig){if(!sig||sig.sig==="WAIT"||limitsReached())return;activeTrade={signal:sig.sig,entry:sig.entry,left:+$("duration").value};$("riskState").textContent="Risk guard: DEMO TRADE OPEN"}
function settle(){if(!activeTrade)return;let exit=prices[prices.length-1],dir=activeTrade.signal,win=dir==="UP"?exit>activeTrade.entry:exit<activeTrade.entry,stake=+$("stake").value,change=win?stake*0.8:-stake;balance+=change;pnl+=change;trades++;if(win){wins++;consecutive=0}else{losses++;consecutive++}journal.unshift({time:new Date().toLocaleTimeString(),signal:dir,entry:activeTrade.entry,exit,result:win?"WIN":"LOSS",pl:change});activeTrade=null;renderStats();renderJournal();limitsReached()}
function renderStats(){$("balance").textContent="$"+balance.toFixed(2);$("trades").textContent=trades;$("wins").textContent=wins;$("pnl").textContent=(pnl>=0?"+":"")+"$"+pnl.toFixed(2)}
function renderJournal(){$("journal").innerHTML=journal.slice(0,20).map(t=>'<tr><td>'+t.time+'</td><td>'+t.signal+'</td><td>'+Number(t.entry).toFixed(5)+'</td><td>'+Number(t.exit).toFixed(5)+'</td><td class="'+(t.result==="WIN"?"win":"loss")+'">'+t.result+'</td><td class="'+(t.pl>=0?"win":"loss")+'">'+(t.pl>=0?"+":"")+"$"+t.pl.toFixed(2)+'</td></tr>').join("")}
function startDemo(){if(demo)return;if(!$("start").disabled)start();demo=true;$("demoStart").disabled=true;$("demoStop").disabled=false;$("modeBadge").textContent="PAPER / DEMO SIMULATOR ACTIVE";demoTimer=setInterval(()=>{if(activeTrade){activeTrade.left--;if(activeTrade.left<=0)settle()}},1000)}
function stopDemo(){demo=false;clearInterval(demoTimer);demoTimer=null;activeTrade=null;$("demoStart").disabled=false;$("demoStop").disabled=true;$("modeBadge").textContent="PAPER / DEMO SIMULATOR";$("riskState").textContent="Risk guard: READY"}
$("start").onclick=start;$("stop").onclick=stop;$("demoStart").onclick=startDemo;$("demoStop").onclick=stopDemo;window.addEventListener("resize",draw);renderStats();

let derivDemoAvailable = false;
let demoOrderBusy = false;
let demoOrderWs = null;

async function refreshDerivAuth() {
  const message = $("authMessage"), connect = $("connectDeriv"), disconnect = $("disconnectDeriv");
  try {
    const response = await fetch("/api/auth/status", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json();
    derivDemoAvailable = Boolean(data.connected && data.demoAvailable);
    $("placeDemoTrade").disabled = !derivDemoAvailable || demoOrderBusy;
    if (data.connected) {
      message.textContent = data.message || "Deriv authorization is connected. No trades are placed by this check.";
      $("status").textContent = "DERIV AUTHORIZED";
      connect.textContent = "Reconnect Deriv";
      disconnect.hidden = false;
      $("tradeStatus").textContent = derivDemoAvailable
        ? "Demo account found. Start analysis and wait for an UP or DOWN signal before testing."
        : "Deriv is connected, but no demo account was verified. No order can be placed.";
    } else {
      message.textContent = data.error || "Not connected. Tap Connect Deriv to authorize securely.";
      connect.textContent = "Connect Deriv";
      disconnect.hidden = true;
      $("tradeStatus").textContent = "Connect Deriv to enable demo-only execution.";
    }
  } catch (_) {
    message.textContent = "Connection status unavailable. The site may still be deploying the secure backend.";
    $("tradeStatus").textContent = "Could not verify Deriv connection. Try reconnecting.";
  }
}

function finishDemoOrder(message) {
  $("tradeStatus").textContent = message;
  demoOrderBusy = false;
  $("placeDemoTrade").disabled = !derivDemoAvailable;
  if (demoOrderWs) {
    try { demoOrderWs.close(); } catch (_) {}
    demoOrderWs = null;
  }
}

async function placeOneDemoTrade() {
  if (demoOrderBusy) return;
  const signal = $("signal").textContent;
  if (!derivDemoAvailable) {
    $("tradeStatus").textContent = "Connect Deriv and verify a demo account first.";
    return;
  }
  if (signal !== "UP" && signal !== "DOWN") {
    $("tradeStatus").textContent = "Wait for a clear UP or DOWN signal before testing.";
    return;
  }
  const stake = Number($("stake").value);
  const duration = Math.floor(Number($("duration").value));
  const symbol = $("symbol").value;
  if (!Number.isFinite(stake) || stake < 0.35 || stake > 1) {
    $("tradeStatus").textContent = "For this first test, stake must be between $0.35 and $1.00.";
    return;
  }
  if (!Number.isInteger(duration) || duration < 1 || duration > 20) {
    $("tradeStatus").textContent = "Duration must be between 1 and 20 ticks.";
    return;
  }
  const contractType = signal === "UP" ? "CALL" : "PUT";
  const approved = window.confirm("Place ONE DEMO trade only?\nMarket: " + symbol + "\nDirection: " + signal + "\nStake: " + stake.toFixed(2) + "\nDuration: " + duration + " ticks\n\nThis is a real order on your Deriv DEMO account, not a paper simulation. It may lose the full stake.");
  if (!approved) return;

  demoOrderBusy = true;
  $("placeDemoTrade").disabled = true;
  $("tradeStatus").textContent = "Opening secure demo connection…";
  let settled = false;
  let timer = setTimeout(() => {
    if (!settled) {
      settled = true;
      finishDemoOrder("Timed out waiting for Deriv. Check your Deriv demo account history before retrying to avoid duplicate orders.");
    }
  }, 120000);

  try {
    const response = await fetch("/api/trade/demo-connection", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    });
    const connection = await response.json();
    if (!response.ok || !connection.ok || connection.accountType !== "demo") {
      clearTimeout(timer);
      settled = true;
      finishDemoOrder(connection.error || "Could not open a verified demo connection. No order was sent.");
      return;
    }
    if (!connection.allowedSymbols || !connection.allowedSymbols.includes(symbol)) {
      clearTimeout(timer);
      settled = true;
      finishDemoOrder("This market is not enabled for the demo test.");
      return;
    }
    const socket = new WebSocket(connection.url);
    demoOrderWs = socket;
    let buySent = false;
    socket.onopen = () => {
      $("tradeStatus").textContent = "Connected to demo account. Requesting a price…";
      socket.send(JSON.stringify({
        proposal: 1,
        amount: stake,
        basis: "stake",
        contract_type: contractType,
        currency: connection.currency,
        duration: duration,
        duration_unit: "t",
        underlying_symbol: symbol,
        req_id: 501
      }));
    };
    socket.onmessage = event => {
      let data;
      try { data = JSON.parse(event.data); } catch (_) { return; }
      if (data.error) {
        clearTimeout(timer);
        settled = true;
        finishDemoOrder("Deriv rejected the demo request: " + String(data.error.message || "unknown error") + ". No further orders will be sent.");
        return;
      }
      if (data.req_id === 501 && data.proposal && !buySent) {
        const proposal = data.proposal;
        if (!proposal.id || !Number.isFinite(Number(proposal.ask_price))) {
          clearTimeout(timer);
          settled = true;
          finishDemoOrder("Deriv did not return a valid price. No order was sent.");
          return;
        }
        buySent = true;
        $("tradeStatus").textContent = "Price received. Sending the single demo order…";
        socket.send(JSON.stringify({ buy: proposal.id, price: Number(proposal.ask_price), req_id: 502 }));
        return;
      }
      if (data.req_id === 502 && data.buy) {
        const contractId = data.buy.contract_id;
        if (!contractId) {
          clearTimeout(timer);
          settled = true;
          finishDemoOrder("Deriv response did not include a contract number. Check demo account history before retrying.");
          return;
        }
        $("tradeStatus").textContent = "Demo order placed (contract " + contractId + "). Waiting for result…";
        socket.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1, req_id: 503 }));
        return;
      }
      if (data.req_id === 503 && data.proposal_open_contract) {
        const contract = data.proposal_open_contract;
        if (contract.is_sold || ["won", "lost", "sold"].includes(String(contract.status || "").toLowerCase())) {
          clearTimeout(timer);
          settled = true;
          const profit = Number(contract.profit);
          const result = Number.isFinite(profit) ? " Final P/L: " + (profit >= 0 ? "+" : "") + profit.toFixed(2) + " " + connection.currency + "." : "";
          finishDemoOrder("Demo contract finished." + result + " Check Deriv's demo account history for the official record.");
        }
      }
    };
    socket.onerror = () => {
      if (!settled) {
        clearTimeout(timer);
        settled = true;
        finishDemoOrder("Demo connection error. Check Deriv demo account history before retrying.");
      }
    };
    socket.onclose = () => {
      if (!settled) {
        clearTimeout(timer);
        settled = true;
        finishDemoOrder("Demo connection closed. Check Deriv demo account history before retrying.");
      }
    };
  } catch (_) {
    clearTimeout(timer);
    settled = true;
    finishDemoOrder("Could not connect to Deriv demo trading. Reconnect and try again after checking account history.");
  }
}
$("connectDeriv").addEventListener("click", () => { window.location.href = "/api/auth/login"; });
$("disconnectDeriv").addEventListener("click", () => { window.location.href = "/api/auth/logout"; });
refreshDerivAuth();
\n$("placeDemoTrade").addEventListener("click", placeOneDemoTrade);\n