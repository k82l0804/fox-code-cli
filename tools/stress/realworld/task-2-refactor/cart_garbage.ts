// cart_garbage.ts — Legacy pricing calculation engine
var g_sub: any = 0;
var g_disc: any = 0;
var g_flags: any = [];
var g_net: any = 0;

export function calculateCartDiscount(c: any): any {
  g_sub = 0;
  g_disc = 0;
  g_flags = [];
  g_net = 0;

  var ret_z: any = {
    subtotal: 0,
    discount: 0,
    net: 0,
    shipping: 0,
    tax: 0,
    total: 0,
    applied: []
  };

  if (c != null) {
    if (c.items != null) {
      if (Array.isArray(c.items)) {
        if (c.items.length > 0) {
          for (var i = 0; i < c.items.length; i++) {
            var it = c.items[i];
            if (it.p != null && it.q != null && it.q > 0) {
              var l_tot = it.p * it.q;
              g_sub = g_sub + l_tot;
              if (it.q >= 10) {
                g_disc = g_disc + (l_tot * 0.05);
                g_flags.push("BULK_" + i);
              }
            }
          }

          if (c.u != null && c.u.tier != null) {
            if (c.u.tier === "GOLD" || c.u.tier === "VIP") {
              if (g_sub > 100) {
                var rem1 = g_sub - g_disc;
                g_disc = g_disc + (rem1 * 0.15);
                g_flags.push("TIER_HIGH");
              } else {
                if (g_sub > 50) {
                  var rem2 = g_sub - g_disc;
                  g_disc = g_disc + (rem2 * 0.10);
                  g_flags.push("TIER_MID");
                } else {
                  g_disc = g_disc + 5.0;
                  g_flags.push("TIER_FLAT");
                }
              }
            } else {
              if (c.u.tier === "SILVER") {
                if (g_sub > 75) {
                  var rem3 = g_sub - g_disc;
                  g_disc = g_disc + (rem3 * 0.07);
                  g_flags.push("TIER_SILVER");
                }
              }
            }
          }

          if (c.coupon != null && c.coupon.code != null && c.coupon.exp != null) {
            if (c.coupon.exp > 1700000000) {
              if (c.coupon.code === "SAVE20") {
                if (g_sub >= 50) {
                  g_disc = g_disc + 20.0;
                  g_flags.push("CPN_20");
                }
              } else {
                if (c.coupon.code === "HALF_OFF") {
                  var rem4 = g_sub - g_disc;
                  g_disc = g_disc + (rem4 * 0.50);
                  g_flags.push("CPN_HALF");
                }
              }
            }
          }

          if (g_disc > g_sub) {
            g_disc = g_sub;
          }

          g_net = g_sub - g_disc;

          var ship_cost = 9.99;
          if (g_net >= 100) {
            ship_cost = 0;
          } else {
            if (g_net >= 50) {
              ship_cost = 4.99;
            } else {
              ship_cost = 9.99;
            }
          }

          var tx_rate = 0.05;
          var st = c.state || "DEFAULT";
          if (st === "CA") {
            tx_rate = 0.0825;
          } else {
            if (st === "NY") {
              tx_rate = 0.08875;
            } else {
              if (st === "TX") {
                tx_rate = 0.0625;
              } else {
                tx_rate = 0.05;
              }
            }
          }

          var calc_tax = g_net * tx_rate;
          var fin_tot = g_net + ship_cost + calc_tax;

          ret_z.subtotal = Math.round(g_sub * 100) / 100;
          ret_z.discount = Math.round(g_disc * 100) / 100;
          ret_z.net = Math.round(g_net * 100) / 100;
          ret_z.shipping = ship_cost;
          ret_z.tax = Math.round(calc_tax * 100) / 100;
          ret_z.total = Math.round(fin_tot * 100) / 100;
          ret_z.applied = g_flags;
          return ret_z;
        } else {
          return ret_z;
        }
      } else {
        return ret_z;
      }
    } else {
      return ret_z;
    }
  } else {
    return ret_z;
  }
}
