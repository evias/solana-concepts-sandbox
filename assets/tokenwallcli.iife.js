// Unexported API
var t = [
  'Payment Required',
  'Pending payment',
  'Payment accepted',
];
function cmb(r, s) {
  let elm = document.createElement('div'),
      elm2 = document.createElement('div'),
      elm3 = document.createElement('div'),
      elm4 = document.createElement('h2'),
      elm6 = document.createElement('div'), // <-- modal content container
      elm7 = document.createElement('div'),
      elm8 = document.createElement('span'),
      elm9 = document.createElement('div'),
      elm10 = document.createElement('div'),
      elm11 = document.createElement('span'),
      elm12 = document.createElement('span');

  elm.classList.add('print:hidden', 'fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'bg-black/50', 'p-4');
  elm2.classList.add('w-full', 'max-w-[420px]', 'rounded-[10px]', 'bg-white', 'shadow-[0_10px_40px_rgba(0,0,0,.2)]');
  elm3.classList.add('flex', 'items-center', 'justify-between', 'border-b', 'border-[#e5e7eb]', 'p-5');
  elm4.classList.add('text-[1.25rem]', 'font-bold', 'text-[#111]');
  elm6.classList.add('flex', 'flex-col', 'gap-4', 'p-6');
  elm7.classList.add('flex', 'min-h-[216px]', 'items-center', 'justify-center');
  elm8.classList.add('inline-block', 'h-3.5', 'w-3.5', 'animate-spin', 'rounded-full', 'border-2', 'border-[#D9E2DF]', 'border-t-[#2E7D6B]');
  elm9.classList.add('mt-3', 'text-[.82rem]', 'text-[#5F6F6A]');
  elm10.classList.add('mx-auto', 'mt-3', 'hidden', 'inline-flex', 'items-center', 'gap-2', 'rounded-full', 'bg-gray-600', 'px-3.5', 'py-1.5', 'text-[.8rem]', 'text-white');

  let cc = 'bg-red-500',
      st = t[1];
  if (s === 'success') {
    cc = 'bg-[#5BD6B5]';
    st = t[2];
  }

  elm11.classList.add('h-2', 'w-2', 'rounded-full', `${cc}`);

  elm4.innerText = t[0];
  elm12.innerText = st;

  elm7.setAttribute('id', `twpay-${r}-qrCode`);
  elm9.setAttribute('id', `twpay-${r}-qrCaption`);
  elm10.setAttribute('id', `twpay-${r}-payStatus`);

  elm10.appendChild(elm11);
  elm10.appendChild(elm12);
  elm7.appendChild(elm8);
  elm6.appendChild(elm7);
  elm6.appendChild(elm9);
  elm6.appendChild(elm10);
  elm3.appendChild(elm4);
  elm2.appendChild(elm3);
  elm2.appendChild(elm6);
  elm.appendChild(elm2)
  return elm;
};

function tc(elm) {
  var tb = function(e) {
    e.classList.toggle('blur');
    e.classList.toggle('select-none');
    e.classList.toggle('pointer-events-none');
  };
  if (elm.tagName !== 'BODY') tb(e);
  else {
    for (let c = 0; c < elm.children.length; c++) {
      let che = elm.children[c];
      if (che.tagName !== 'SCRIPT') {
        tb(che);
      }
    }
  }
};

// IIFE
(function (i, r) {
  i['TokenWallPayObject'] = r;
  i[r] = i[r] || function () {
    (i[r].q = i[r].q || []).push(arguments);

    i[r].ref = null;
    i[r].sel = null;
    i[r].dom = null;
    i[r].elm = null;
    i[r].sib = null;
    i[r].err = null;
    i[r].qlm = null;
    i[r].clm = null;
    i[r].slm = null;
  };
  i[r].init = function(ref, sel) {
    this.ref = ref;
    this.sel = sel;
    if (typeof sel !== undefined && sel.length)
      this.elm = document.querySelector(this.sel);
    this.dom = document.querySelector('body');
    this.sib = document.querySelector('script');
  };
  i[r].lock = function() {
    if (this.elm !== null) tc(this.elm);
    this.dom.appendChild(cmb(this.ref, 'pending'));

    this.qlm = document.querySelector(`#twpay-${this.ref}-qrCode`);
    this.clm = document.querySelector(`#twpay-${this.ref}-qrCaption`);
    this.slm = document.querySelector(`#twpay-${this.ref}-payStatus`);


    //XXX retrieve invoice information
    //XXX create/display QR
    //XXX start pulling for payment updates
  };

  for (let c = 0; c < i[r].q.length; c++) {
    var fn = i[r].q[c][0];
    var args = [];
    for (let a = 1; a < i[r].q[c].length; a++) {
      args.push(i[r].q[c][a]);
    }

    i[r][fn].apply(i[r], args);
  }
})(window, '_twp');