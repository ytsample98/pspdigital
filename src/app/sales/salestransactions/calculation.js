export function getTaxDetailsFromGroup(groupName, taxGroups) {
  if (!groupName || groupName === 'nill' || groupName === 'more')
    return { totalPercent: 0, totalAmount: 0 };

  const group = taxGroups.find(tg => tg.groupName === groupName);
  if (!group || !Array.isArray(group.lineItems))
    return { totalPercent: 0, totalAmount: 0 };

  let totalPercent = 0;
  let totalAmount = 0;

  group.lineItems.forEach(item => {
    if (item.type === 'Percentage') totalPercent += parseFloat(item.percentOrAmt || 0);
    else if (item.type === 'Amount') totalAmount += parseFloat(item.percentOrAmt || 0);
  });

  return { totalPercent, totalAmount };
}

export function recalculateTotals({ lineItems, freightCharges, packingCharges, taxPercent, taxGroups }) {
  let lineTotal = 0;
  let lineTaxTotal = 0;

  const updatedLineItems = lineItems.map(item => {
    const qty = parseFloat(item.qty ?? item.quoteqty ?? item.orderQty ?? 0) || 0;
    const unitPrice = parseFloat(item.unitPrice || 0);
    const baseTotal = unitPrice * qty;        // ✅ total without tax

    const groupNames = item.taxGroupNames?.length
      ? item.taxGroupNames
      : [item.taxGroupName || item.taxId || ''];

    let percent = 0, amount = 0;
    groupNames.forEach(groupName => {
      const group = taxGroups.find(t => t.groupName === groupName);
      if (group && Array.isArray(group.lineItems)) {
        group.lineItems.forEach(comp => {
          const val = parseFloat(comp.percentOrAmt || 0);
          if (comp.type === 'Percentage') percent += val;
          if (comp.type === 'Amount') amount += val;
        });
      }
    });

    const itemTaxAmt = (baseTotal * percent) / 100 + amount;

    lineTotal += baseTotal;
    lineTaxTotal += itemTaxAmt;

    return {
      ...item,
      qty,
      taxAmt: itemTaxAmt.toFixed(2),
      total: baseTotal.toFixed(2)   // ✅ exclude tax
    };
  });

  const freight = parseFloat(freightCharges || 0);
  const packing = parseFloat(packingCharges || 0);
  const freightPercent = parseFloat(taxPercent || 0);
  const freightTaxAmount = (freight * freightPercent) / 100;

  const totalTaxAmount = lineTaxTotal + freightTaxAmount;
  const docValue = lineTotal + freight + packing + lineTaxTotal + freightTaxAmount;

  return {
    updatedLineItems,
    freighttaxAmount: freightTaxAmount.toFixed(2),
    taxAmount: totalTaxAmount.toFixed(2),
    quoteValue: docValue.toFixed(2),  // 👈 always return "quoteValue"
    orderValue: docValue.toFixed(2),  // 👈 also return "orderValue"
    invoiceValue: docValue.toFixed(2),// 👈 also return "invoiceValue"
    billValue: docValue.toFixed(2)    // 👈 also return "billValue"
  };
}
