const fs = require('fs');
const file = 'd:/PROJECT AI/PrjNewMenu/standalone_demo.html';
let content = fs.readFileSync(file, 'utf8');

const regex = /        getB5ItemJumlahRp\(itm\) \{[\s\S]*?        \},/;

const replacementStr = `        getB5ItemUnitPcostSar(itm) {
          if (!itm) return 0;
          const unitCost = Number(itm.unitCost || 0);
          const rateX = Number(itm.rateX || 1);
          if (itm.calcType === 'opr_muthawwif_idr' || itm.calcType === 'idr_rate_convert') {
            return rateX > 0 ? unitCost / rateX : 0;
          }
          return unitCost * rateX;
        },

        getB5ItemQty(itm) {
          if (!itm) return 1;
          const asumsi = this.getTargetColAsumsi();
          const durStr = asumsi.paket || '9H';
          const durasiHari = parseInt(durStr) || 9;
          
          if (itm.calcType === 'muthowwif_fee' || itm.calcType === 'beban_kamar_muthowwif') {
            return Math.max(1, durasiHari - 1);
          }
          return 1;
        },

        getB5ItemCostPerPaxSar(itm) {
          if (!itm) return 0;
          const asumsi = this.getTargetColAsumsi();
          const totalJamaah = Math.max(1, Number(asumsi.totalJamaah || 35));
          const pCost = this.getB5ItemUnitPcostSar(itm);
          const qty = this.getB5ItemQty(itm);
          
          if (itm.calcType === 'muthowwif_fee' || itm.calcType === 'opr_muthawwif_idr' || itm.calcType === 'beban_kamar_muthowwif') {
            return (pCost * qty) / totalJamaah;
          }
          return pCost * qty;
        },

        getB5ItemJumlahRp(itm) {
          if (!itm) return 0;
          const asumsi = this.getTargetColAsumsi();
          const rateSarRp = Number(asumsi.rateSarRp || 4900);
          const costPerPaxSar = this.getB5ItemCostPerPaxSar(itm);
          return costPerPaxSar * rateSarRp;
        },`;

if (regex.test(content)) {
    content = content.replace(regex, replacementStr);
    fs.writeFileSync(file, content);
    console.log("Success");
} else {
    console.log("Regex not matched");
}
