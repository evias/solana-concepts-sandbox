// Unexported API
var i18n_en = {
  'uc_payment_required': 'Payment Required',
  'status_pending': 'Waiting for payment',
  'status_partial': 'Waiting for payment (*)',
  'status_accepted': 'Payment completed',
  'button_pay_now': 'Pay now (%AMOUNT%)',
  'explain_qrcode': 'Use the QRCode below to pay with your Solana Wallet.',
  'partial_explain': '(*) Received a partial payment for %AMOUNT%.',
  'accepted_explain': 'This window will automatically close in 3 seconds.'
};
function cmb(r, s) {
  let texts = i18n_en;
  let divParent = document.createElement('div'),
      divLayout = document.createElement('div'),
        divHeader = document.createElement('div'),
          h2Title = document.createElement('h2'),
        divContent = document.createElement('div'),
          emExplain = document.createElement('em'),
          divQrCode = document.createElement('div'),
            spanLoading = document.createElement('span'),
          divCaption = document.createElement('div'),
          divStatus = document.createElement('div'),
            divStatusChip = document.createElement('span'),
            spanStatus = document.createElement('span'),
          emAsterisk = document.createElement('em');

  divParent.classList.add('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'bg-black/50', 'p-4');
  divLayout.classList.add('w-full', 'max-w-[420px]', 'rounded-[10px]', 'bg-white', 'shadow-[0_10px_40px_rgba(0,0,0,.2)]');
  divHeader.classList.add('flex', 'items-center', 'justify-between', 'border-b', 'border-[#e5e7eb]', 'p-5');
  h2Title.classList.add('mx-auto', 'text-md', 'sm:text-[1.25rem]', 'font-bold', 'text-[#111]');
  divContent.classList.add('flex', 'flex-col', 'gap-1', 'sm:gap-4', 'p-3', 'sm:p-6');
  emExplain.classList.add('my-1', 'text-xs', 'sm:text-sm', 'font-normal', 'text-[#5F6F6A]', 'px-10', 'sm:px-0');
  divQrCode.classList.add('flex', 'min-h-[150px]', 'sm:min-h-[216px]', 'items-center', 'justify-center');
  spanLoading.classList.add('inline-block', 'h-3.5', 'w-3.5', 'animate-spin', 'rounded-full', 'border-2', 'border-[#D9E2DF]', 'border-t-[#2E7D6B]');
  divCaption.classList.add('mx-auto', 'text-[.82rem]', 'text-[#5F6F6A]');
  divStatus.classList.add('mx-auto', 'mt-3', 'hidden', 'inline-flex', 'items-center', 'gap-2', 'rounded-full', 'bg-gray-600', 'px-3.5', 'py-1.5', 'text-[.8rem]', 'text-white');
  emAsterisk.classList.add('hidden', 'text-xs', 'sm:text-sm', 'font-normal', 'text-[#5F6F6A]', 'px-10', 'sm:px-0');

  let cc = 'bg-red-500',
      st = texts['status_pending'];
  if (s === 'accepted') {
    cc = 'bg-[#5BD6B5]';
    st = texts['status_accepted'];
  }
  divStatusChip.classList.add('h-2', 'w-2', 'rounded-full', `${cc}`);

  h2Title.innerText = texts['uc_payment_required'];
  spanStatus.innerText = st;
  emExplain.innerText = texts['explain_qrcode'];

  divQrCode.setAttribute('id', `twpay-${r}-qrCode`);
  divCaption.setAttribute('id', `twpay-${r}-qrCaption`);
  spanStatus.setAttribute('id', `twpay-${r}-payStatus`);
  divStatusChip.setAttribute('id', `twpay-${r}-statusChip`);
  emAsterisk.setAttribute('id', `twpay-${r}-partialExplain`);

  divStatus.appendChild(divStatusChip);
  divStatus.appendChild(spanStatus);
  divQrCode.appendChild(spanLoading);
  divContent.appendChild(emExplain);
  divContent.appendChild(divQrCode);
  divContent.appendChild(divCaption);
  divContent.appendChild(divStatus);
  divContent.appendChild(emAsterisk);
  divHeader.appendChild(h2Title);
  divLayout.appendChild(divHeader);
  divLayout.appendChild(divContent);
  divParent.appendChild(divLayout)
  return divParent;
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

function uag() {
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return array.toHex();
};

// IIFE
(function (i, r) {
  i['TokenWallPayObject'] = r;
  i[r] = i[r] || function () {
    (i[r].q = i[r].q || []).push(arguments);

    i[r].uag = null;
    i[r].ref = null;
    i[r].sel = null;
    i[r].dom = null;
    i[r].elm = null;
    i[r].sib = null;
    i[r].err = null;
    i[r].mod = null;
    i[r].qlm = null;
    i[r].clm = null;
    i[r].slm = null;
  };
  i[r].init = function(ref, sel) {
    this.uag = uag();
    this.ref = ref;
    this.pref= this.uag;
    this.sel = sel;
    if (typeof sel !== undefined && sel.length)
      this.elm = document.querySelector(this.sel);
    this.dom = document.querySelector('body');
    this.sib = document.querySelector('script');
  };
  i[r].lock = async function(api) {
    if (this.elm !== null) tc(this.elm);
    this.mod = cmb(this.ref, 'pending');
    this.dom.appendChild(this.mod);

    this.qlm = document.querySelector(`#twpay-${this.ref}-qrCode`);
    this.clm = document.querySelector(`#twpay-${this.ref}-qrCaption`);
    this.slm = document.querySelector(`#twpay-${this.ref}-payStatus`);

    const texts = i18n_en;
    const dataUrl = `//${api}/tokenwall/invoice`;
    const dataParams = `invoiceRef=${this.ref}&paymentRef=${this.pref}&enableMeta=1`;
    const response = await fetch(`${dataUrl}?${dataParams}`);
    if (response.ok) {
      const data = await response.json();
      this.qlm.innerHTML = data.qrCode;
      this.clm.innerHTML = `
<a href="${data.paymentUrl}"
   class="group relative flex w-[200px] justify-center rounded-md bg-indigo-600 pl-5 py-3 text-xs font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-75 disabled:cursor-not-allowed">
  <span class="absolute inset-y-0 left-0 flex items-center pl-3">
    <svg class="h-5 w-5 text-indigo-500 group-hover:text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
    </svg>
  </span>
  ${texts['button_pay_now'].replace('%AMOUNT%', data.uiTokenAmount)}
</a>
      `;
    }

    const spanStatusElm = document.querySelector(`#twpay-${this.ref}-payStatus`);
    const divStatusChip = document.querySelector(`#twpay-${this.ref}-statusChip`);
    const emAsterisk = document.querySelector(`#twpay-${this.ref}-partialExplain`);

    let intervalStatusPoll = undefined;
    const pollInvoiceStatusFn = async () => {
      const pollUrl = `//${api}/tokenwall/status`;
      const pollParams = `invoiceRef=${this.ref}&paymentRef=${this.pref}`;
      const response = await fetch(`${pollUrl}?${pollParams}`);

      const data = await response.json();
      spanStatusElm.innerText = texts['status_' + data.status];
      if (data.status === 'accepted') {
        divStatusChip.classList.remove('bg-red-500', 'bg-yellow-500');
        divStatusChip.classList.add('bg-[#5BD6B5]');
        emAsterisk.classList.remove('hidden');
        emAsterisk.innerText = texts['accepted_explain'];

        clearInterval(intervalStatusPoll);
        setTimeout(() => {
          this.mod.remove();
          tc(this.elm);
        }, 3000);
      } else if (data.status === 'partial') {
        divStatusChip.classList.remove('bg-red-500');
        divStatusChip.classList.add('bg-yellow-500');
        emAsterisk.classList.remove('hidden');
        emAsterisk.innerText = texts['partial_explain'].replace('%AMOUNT%', data.uiTokenAmount);
      }
    };

    // Poll for payment updates every 5 seconds during 30 minutes.
    intervalStatusPoll = setInterval(pollInvoiceStatusFn, 5 * 1000);
    pollInvoiceStatusFn(); // poll on-load as well.
    setTimeout(() => {
      clearInterval(intervalStatusPoll)
    }, 30 * 60 * 1000);
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