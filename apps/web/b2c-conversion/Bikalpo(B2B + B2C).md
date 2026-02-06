# core content

#  **Project Brief**

## **Project Name: Bikalpo.com**

## **Type: Location Based Multi-Vendor Marketplace (B2B \+ B2C)**

**Dealer (Admin / Super Seller) → Shop Owner (B2B)**  
**Shop Owner → Consumer (B2C)**

# **USER ROLE & PERMISSION MODEL**

## **✅ STEP–1: ACCOUNT CREATION FLOW**

### **👤 Consumer (Default)**

Flow:  
 Install App  
 → Sign Up (Phone OTP)  
 → Auto Consumer Account Created  
 → Direct Home Screen

Rules:

* Role select নাই

* User জানবে না অন্য role আছে

* Default role \= consumer

---

### **🏪 Shop Owner**

Flow:  
 Install App  
 → Sign Up (Consumer created)  
 → Apply for Business Account  
 → Submit Documents  
 → Admin Approval  
 → Role upgraded to Shop Owner

UI:  
 Button: **Become a Business Seller**

Rules:

* Admin approval mandatory

* Fake seller prevent

* Model assign future ready

---

### **👷 Employee**

Flow:  
 Admin creates employee  
 → SMS invite  
 → App install  
 → Login by phone  
 → Auto role \= employee

Rules:

* Employee cannot choose role

* Security & audit friendly

---

## **✅ STEP–2: ROLE vs CAPABILITY MATRIX (Clean)**

| Role | Can Buy | Can Sell | Notes |
| ----- | ----- | ----- | ----- |
| Admin | ❌ | ✅ (B2B only) | Sells to shop owners |
| Shop Owner (Seller) | ✅ (B2B) | ✅ (B2C) | Admin approved |
| Shop Owner (Buyer only) | ✅ | ❌ | Restaurant type |
| Consumer | ✅ (B2C) | ❌ | Cannot sell |
| Employee | ❌ | ❌ | Operational only |

---

## **✅ STEP–3: SELLER ELIGIBILITY RULES**

Only Admin can:

* Enable seller

* Approve shop

Seller must satisfy:  
 ✔ seller\_status \= approved  
 ✔ can\_accept\_open\_order \= true  
 ✔ area permission matched  
 ✔ product model matched

Else:

* Cannot sell

* Cannot receive open order

---

## **✅ STEP–4: PRODUCT SELLING PERMISSION**

Shop Owner can sell only:  
 ✔ Admin assigned products  
 ✔ Products in assigned model  
 ✔ Products in stock

Shop Owner cannot:  
 ❌ Add product manually  
 ❌ Sell outside model

But can:  
 ✔ Request new product

---

## **✅ STEP–5: STOCK PERMISSION**

Shop Owner can:  
 ✔ View stock  
 ✔ Report damage  
 ✔ Reduce stock with reason

Shop Owner cannot:  
 ❌ Edit ledger

---

## **✅ STEP–6: PRICING RESPONSIBILITY**

Admin:  
 ✔ Sets base price  
 ✔ Sets delivery rules

Shop Owner:  
 ✔ Sets shop selling price  
 ✔ Must update at least once every 24h  
 ✔ Can update anytime

Consumer sees:

* Platform base price

* Seller price (store page)

Validation:  
 shop\_price ≥ base\_price \+ min\_margin

---

## **✅ STEP–7: BUYER–SELLER MAPPING BY ORDER TYPE**

### **🟦 B2B**

Buyer → Shop Owner  
 Seller → Super Seller

### **🟢 B2C Direct**

Buyer → Consumer  
 Seller → Shop Owner

### **🤖 Open Order**

Buyer → Consumer  
 Seller → NULL  
 After accept → Shop Owner

---

## **✅ STEP–8: AREA PERMISSION**

Shop Owner can:  
 ✔ View orders only inside area  
 ✔ Receive open order only in area

---

## **✅ STEP–9: OTP LOAD CONTROL**

Rule:  
 Each seller max **2 pending OTP**

If reached:  
 ❌ No new open orders  
 ✔ Direct orders allowed  
 (Admin can reset)

---

**PRODUCT \+ VARIANT \+ PACK SYSTEM**

## **🎯 CORE PHILOSOPHY (From Your Concept)**

✔ Product ও Variant সবার জন্য এক  
 ✔ SKU globally same (Super Seller \+ Shop Owner)  
 ✔ পার্থক্য হবে শুধু:

* Stock Owner

* Available Qty

* Selling Price

* Pack Return Rule (seller override)

✔ Conversion system auto কাজ করবে  
 ✔ Pack return rule product level এ থাকবে, কিন্তু seller override করতে পারবে

---

## **✅ STEP–1: PRODUCT (MASTER DATA – GLOBAL)**

📦 **products**

id  
name  
category\_id  
brand\_id  
description

is\_returnable\_pack (true/false)          ← default rule  
default\_pack\_deposit\_amount

allowed\_pack\_brands (json)  
allowed\_pack\_sizes (json)

status  
created\_at

### **Business Rules**

If is\_returnable\_pack \== false  
 → Pack UI hidden  
 → No deposit applied

If is\_returnable\_pack \== true  
 → Pack info mandatory during order

👉 এই টেবিল **সব owner এর জন্য same**  
 👉 Super Seller \+ Seller সবাই একই product দেখে

---

## **✅ STEP–2: PRODUCT VARIANTS (SHARED BY ALL)**

📦 **product\_variants**

id  
product\_id  
sku

variant\_type (TRADE / RETAIL)

pack\_type (sack / carton / packet / loose)

pack\_weight\_kg  
inner\_pack\_size\_kg  
pack\_count\_inside

sell\_unit  
order\_type (B2B / B2C)

min\_order  
max\_order

base\_price                 ← Super Seller default

visibility\_role (shop\_owner / consumer)

delivery\_type  
delivery\_rule\_id

linked\_retail\_variant\_id  
conversion\_ratio

is\_open\_order\_allowed (true/false)  
negotiation\_timeout\_sec

status  
created\_at  
updated\_at

### **Important Rules**

✔ Same Variant exists in:

* Super Seller inventory

* Shop Owner inventory

✔ SKU same everywhere  
 ✔ Variant defines:

* Pack structure

* Order type

* Conversion link

---

## **✅ STEP–3: VARIANT EXAMPLES (Your Given Models)**

### **🔵 Variant V1 — B2B Bulk Sack (Loose)**

* Variant Type: TRADE

* Pack Type: Sack

* Pack Weight: 50 KG

* Sell Unit: Sack

* Order Type: B2B

* Stock Source: Super Seller

* Visibility: shop\_owner

* Linked Retail: Loose Retail

* Conversion: 1 Sack \= 50 KG Loose

---

### **🔵 Variant V2 — B2B Carton Pack**

* Variant Type: TRADE

* Pack Type: Carton

* Pack Weight: 50 KG

* Inner Packs: 10 × 5 KG

* Sell Unit: Carton

* Order Type: B2B

* Stock Source: Super Seller

* Visibility: shop\_owner

* Linked Retail: 5 KG Retail Pack

* Conversion: 1 Carton \= 10 Packs

---

### **🟢 Variant V3 — B2C Retail Pack**

* Variant Type: RETAIL

* Pack Type: Packet

* Pack Weight: 5 KG

* Sell Unit: Packet

* Order Type: B2C

* Stock Source: Shop

* Visibility: consumer

---

### **🟢 Variant V4 — Loose Retail**

* Variant Type: RETAIL

* Pack Type: Loose

* Sell Unit: KG

* Order Type: B2C

* Stock Source: Shop

* Visibility: consumer

---

## **✅ STEP–4: UI VISIBILITY LOGIC**

If user.role \== shop\_owner  
 → Show only **TRADE variants**

If user.role \== consumer  
 → Show only **RETAIL variants**

👉 Product same  
 👉 Only Variant filtered by role

---

## **✅ STEP–5: PACK RETURN CONFIGURATION (OVERRIDE MODEL)**

📦 **product\_pack\_rules**

id  
product\_id

owner\_type (super\_seller / shop)  
owner\_id

is\_empty\_pack\_returnable (true/false)  
empty\_pack\_value

status  
updated\_at

### **Priority Logic**

If shop rule exists  
 → Use shop rule

Else  
 → Use super seller rule

Else  
 → Use product default rule

---

## **✅ STEP–6: CONSUMER ORDER TIME PACK FLOW**

### **UI Logic**

If final rule \= returnable  
 → Show Pack Section

Else  
 → No pack UI

---

### **Pack Section**

Do you have old pack?  
 \[ YES \] \[ NO \]

---

### **If YES**

Previous Pack Brand  
 Previous Pack Size

New Pack Brand  
 New Pack Size

---

### **If NO**

Show:  
 "Deposit ৳XXX will be added"

Deposit auto added to order total

---

### **Order Payload**

**Case — Has Pack**

has\_old\_pack \= true  
old\_brand  
old\_size  
new\_brand  
new\_size  
deposit\_applied \= false

**Case — No Pack**

has\_old\_pack \= false  
deposit\_applied \= true  
deposit\_amount

---

## **✅ STEP–7: BILLING & INVOICE INTEGRATION**

### **Order Total**

order\_total \=  
 product\_total  
\+ delivery\_charge  
\+ (deposit if pack missing)

---

### **Invoice Shows**

✔ Product amount  
 ✔ Delivery charge  
 ✔ Pack deposit (if applied)

---

## **✅ STEP–8: DELIVERY CONFIRMATION FLOW (PACK)**

Delivery App:

Did customer return empty pack?  
 \[ YES \] \[ NO \]

---

If YES:  
 ✔ Optional photo  
 ✔ No deposit kept

If NO:  
 ✔ Deposit confirmed  
 ✔ Ledger entry created  
 ✔ Customer notified

---

## **✅ STEP–9: FRAUD & VALIDATION RULES**

✔ Delivery confirmation mandatory  
 ✔ Photo stored if uploaded  
 ✔ Dispute allowed within 24h  
 ✔ Admin override allowed  
 ✔ All actions logged

---

# **INVENTORY & AUTO CONVERSION SYSTEM**

## **(Single Source of Truth \+ Ledger Driven)**

## **🎯 CORE INVENTORY PHILOSOPHY**

✔ Inventory snapshot শুধু বর্তমান ব্যালেন্স দেখাবে  
 ✔ সব stock movement যাবে immutable ledger এ  
 ✔ Super Seller এবং Shop Owner এর stock আলাদা owner এ থাকবে  
 ✔ Conversion হলে IN \+ OUT দুইটাই ledger এ যাবে  
 ✔ Damaged stock আলাদা bucket হবে না  
 ✔ Damage সরাসরি available\_qty থেকে কমবে

---

## **✅ STEP–1: INVENTORY OWNERSHIP MODEL**

### **Ownership Chain**

Super Seller Inventory (TRADE Variant)  
        ↓  B2B Sale  
Auto Conversion Engine  
        ↓  
Shop Owner Inventory (RETAIL Variant)  
        ↓  B2C Sale  
Consumer

### **Owner Type vs Usage**

| Owner Type | Stock Used For |
| ----- | ----- |
| super\_seller | B2B Sell |
| shop | B2C Sell |
| system | Conversion buffer (virtual only) |

---

## **✅ STEP–2: INVENTORY SNAPSHOT TABLE**

📦 **inventories**

id  
owner\_type (super\_seller / shop)  
owner\_id

variant\_id

available\_qty  
reserved\_qty

updated\_at

### **Safety Rules**

✔ available\_qty \>= 0  
 ✔ reserved\_qty \>= 0  
 ✔ No damaged\_qty column  
 ✔ No manual stock increase by shop

---

## **✅ STEP–3: STOCK LEDGER (IMMUTABLE HISTORY)**

📜 **stock\_ledger**

id  
variant\_id

owner\_type  
owner\_id

change\_type  
 (IN / OUT / CONVERT\_IN / CONVERT\_OUT / DAMAGE / RETURN / ADJUST)

qty  
reason

reference\_type (order / return / damage / manual / conversion)  
reference\_id

balance\_after  
created\_at

### **Ledger Rules**

✔ Every stock change must create ledger  
 ✔ Ledger cannot be edited or deleted  
 ✔ Balance\_after stored for audit

---

## **✅ STEP–4: VARIANT CONVERSION MAP**

📦 **variant\_conversion\_map**

from\_variant\_id  
to\_variant\_id  
conversion\_ratio  
auto\_convert (true/false)

### **Example**

| From (TRADE) | To (RETAIL) | Ratio |
| ----- | ----- | ----- |
| Carton | 5kg Pack | 10 |
| Sack | Loose KG | 50 |

✔ Conversion always atomic (IN \+ OUT together)

---

## **✅ STEP–5: B2B ORDER → AUTO CONVERSION FLOW**

### **Scenario–A: Carton Purchase**

Shop buys:  
 2 Carton

#### **System Actions**

**Super Seller Inventory**  
 \-2 Carton → OUT

**Shop Trade Inventory**  
 \+2 Carton → IN

**Auto Conversion Triggered**

**Shop Retail Inventory**  
 \+20 Retail Pack → CONVERT\_IN

**Shop Trade Inventory**  
 \-2 Carton → CONVERT\_OUT

✔ Trade stock disappears from shop  
 ✔ Only retail remains sellable

---

### **Scenario–B: Sack Loose Purchase**

Shop buys:  
 1 Sack (50kg)

#### **System**

Super Seller:  
 \-1 Sack → OUT

Shop Trade:  
 \+1 Sack → IN

Auto Convert:  
 \+50 KG Loose → CONVERT\_IN  
 \-1 Sack → CONVERT\_OUT

---

## **✅ STEP–6: B2C SALE FLOW**

### **Scenario–C: Consumer Purchase**

Consumer buys:  
 3 Pack

#### **System**

Shop Retail Inventory:  
 \-3 Pack → OUT

Ledger entry created

---

## **✅ STEP–7: RETURN & DAMAGE HANDLING**

### **When Return Requested**

❌ No stock change

---

### **When Return Approved & Received**

#### **If Resellable**

available\_qty \+= return\_qty  
 Ledger → RETURN

---

#### **If Damaged / Expired**

No stock added  
 available\_qty \-= return\_qty  
 Ledger → DAMAGE

---

## **✅ STEP–8: DAMAGE REPORTING MODEL**

### **Damage Logic**

When damage reported:

IF available\_qty \>= damage\_qty:  
   available\_qty \-= damage\_qty  
   ledger entry (DAMAGE)  
ELSE:  
   reject

### **Damage Types (All treated as loss)**

Broken  
 Wet  
 Expired  
 Mishandled

✔ No repair tracking  
 ✔ Admin can manual adjust with audit

---

## **✅ STEP–9: STOCK RESERVATION & LOCKING**

### **Reservation Logic**

#### **When Order Created**

available\_qty ↓  
 reserved\_qty ↑

---

#### **When Order Confirmed**

reserved\_qty ↓  
 Final OUT applied

---

#### **When Order Cancelled / Expired**

reserved\_qty → available\_qty

---

## **✅ STEP–10: OTP SAFETY INVENTORY RULE**

If seller.pending\_otp\_orders \>= 2:

✔ Direct order allowed  
 ❌ Open order stock cannot be reserved  
 ❌ New open order not pushed

Prevents seller blocking inventory

---

## **✅ STEP–11: PERMISSION MODEL**

### **🏪 Shop Owner**

Can:  
 ✔ View stock  
 ✔ Report damage  
 ✔ View ledger (read-only)

Cannot:  
 ❌ Add stock  
 ❌ Add new product  
 ❌ Edit ledger  
 ❌ Inflate inventory

---

### **🧑‍💼 Admin / Super Seller**

Can:  
 ✔ Import stock  
 ✔ Manual adjustment (with audit)  
 ✔ Full ledger access  
 ✔ Correction after fraud

---

## **✅ STEP–12: EXTERNAL STOCK TAG (OPTIONAL LABEL)**

external\_stock\_flag \= true

Rules:

✔ Display only  
 ✔ Not counted in inventory  
 ✔ Cannot be sold unless admin approves mapping

Purpose: prevent fake stock inflation

---

# **ORDER AUTO-SPLIT \+ OPEN ORDER \+ NEGOTIATION**

## **🎯 CORE CONCEPT**

✔ Consumer ভাবে সে **একটা অর্ডার** করছে  
 ✔ System ভিতরে ভিতরে **multiple sub-order তৈরি করবে**  
 ✔ প্রতিটা sub-order যাবে শুধু **eligible seller দের কাছে**  
 ✔ Open Order হলে **price negotiation থাকবে**  
 ✔ Consumer শেষে **seller-wise offer accept করবে**

---

## **✅ STEP–1: MASTER ORDER vs SUB-ORDER STRUCTURE**

### **🧾 MASTER ORDER (Consumer View Only)**

Consumer দেখবে:

Order \#ORD-1001  
 Total Items: 5  
 Total Price: ৳1200  
 Status: Processing by multiple sellers

👉 Payment \+ tracking unified

---

### **📦 SUB-ORDER (Seller Level)**

System creates:

Sub-Order A → Seller X  
 Products: Rice, Dal

Sub-Order B → Seller Y  
 Products: Oil

✔ Seller শুধু নিজের sub-order দেখবে  
 ✔ OTP, delivery, invoice হবে sub-order অনুযায়ী

---

## **✅ STEP–2: AUTO-SPLIT ENGINE (CART → GROUPING)**

### **System Checks per Product**

For each cart item:

✔ Product allowed by seller model  
 ✔ Seller active  
 ✔ Stock available  
 ✔ Area permitted

---

### **Grouping Logic**

System groups items by seller:

Example:

Seller X → Rice \+ Dal  
 Seller Y → Oil

Creates:

Sub-Order X  
 Sub-Order Y

---

## **✅ STEP–3: OPEN ORDER \+ SPLIT COMBINATION**

### **Rule–1: Try Single Seller First**

If any seller can supply **ALL items**:

→ Normal Open Order  
 → No split

---

### **Rule–2: If No Single Seller**

Auto split into:

Multiple Open Sub-Orders

Each sub-order broadcasted separately

Consumer sees:

“Your order is being processed by multiple nearby sellers.”

---

## **✅ STEP–4: OPEN ORDER MATCHING FILTER**

Each Sub-Order broadcast only to:

✔ Product allowed by model  
 ✔ Area permission matched  
 ✔ Stock available  
 ✔ Seller active  
 ✔ seller.can\_accept\_open\_order \= true  
 ✔ pending\_otp \< 2

❌ Not broadcast to whole area  
 ❌ Not broadcast to unrelated category sellers

---

## **✅ STEP–5: SELLER PICK (LOCK) RULE**

### **Broadcast Stage**

Eligible sellers get:

🔔 New Open Order Available

---

### **First Seller Who Clicks ACCEPT**

System sets:

status \= LOCKED  
 seller\_id \= shop\_id  
 locked\_at \= now  
 negotiation\_deadline \= now \+ 100 sec

Inventory:

available\_qty ↓  
 reserved\_qty ↑

Other sellers:

❌ Order disappears

---

## **🔒 MOST IMPORTANT RULE — SELLER WORKFLOW LOCK**

👉 Seller **must PICK (LOCK)** order to:

✔ See price difference  
 ✔ Edit seller price  
 ✔ Submit negotiation

---

### **While Seller is Negotiating**

Until submit or expire:

❌ No new open order notification  
 ❌ No price negotiation on other orders

Purpose:  
 Prevents price blocking abuse

---

## **✅ STEP–6: PRICE NEGOTIATION SCREEN (SELLER)**

Seller sees:

| SKU | Product | Qty | Platform Unit | Platform Total | Seller Unit |
| ----- | ----- | ----- | ----- | ----- | ----- |
| RICE-5500 | Mustard Oil 1L | 2 | 250 | 500 | 280 |
| RICE-5590 | Nazirshail 5kg | 1 | 450 | 450 | 430 |

Bottom Summary:

Platform Price: ৳1200  
 Seller Price: ৳1150  
 Delivery: ৳40  
 Difference: \+৳50

---

### **Seller Must Submit Within 100 sec**

Submit payload:

vendor\_price  
 delivery\_charge  
 total\_price

System:

negotiation\_status \= SUBMITTED  
 status \= NEGOTIATING

---

### **If Seller Fails to Submit**

status \= EXPIRED  
 reserved stock released

---

## **✅ STEP–7: CONSUMER OFFER REVIEW (MULTI SELLER)**

Consumer sees:

🧾 Invoice Summary — Order \#ORD-1001  
 Seller Wise Offers:

---

### **Seller X Offers**

Invoice — Shop X-1  
 Products: Rice, Dal  
 Subtotal: ৳700  
 \[ Accept \] \[ Reject \]

Invoice — Shop X-2  
 Subtotal: ৳650  
 \[ Accept \] \[ Reject \]

---

### **Seller Y Offers**

Invoice — Shop Y-1  
 Product: Gas  
 Subtotal: ৳520  
 \[ Accept \] \[ Reject \]

Invoice — Shop Y-2  
 Subtotal: ৳480  
 \[ Accept \] \[ Reject \]

---

## **✅ STEP–8: FINAL CONSUMER SELECTION**

Consumer selects:

Shop X-2 → ৳650  
 Shop Y-2 → ৳480

System Summary:

Platform Total: ৳1200  
 Seller Total: ৳1130  
 Delivery: ৳40  
 Difference: \+৳30

Buttons:

\[ Confirm Order \]  
 \[ Cancel Order \]

---

## **✅ STEP–9: IF CONSUMER ACCEPTS**

For selected sub-orders:

status \= CONFIRMED  
 OTP generated  
 Delivery initiated

Other seller offers:

❌ Auto cancelled  
 Inventory released

---

## **❌ STEP–10: IF CONSUMER REJECTS**

status \= CANCELLED  
 reserved stock released

Options:

✔ Try again  
 ✔ Cancel full order

---

## **✅ STEP–11: ORDER STATUS VIEW**

### **Consumer Status Flow**

OPEN → Waiting Seller  
 LOCKED → Seller preparing offer  
 NEGOTIATING → Reviewing price  
 CONFIRMED → OTP received

---

### **Seller Status Flow**

NEW → ACCEPT  
 LOCKED → Price submit  
 WAITING → Consumer decision  
 CONFIRMED → Prepare delivery

---

## **✅ STEP–12: OTP SAFETY LIMIT**

If seller.pending\_otp \>= 2:

❌ No new open order broadcast  
 ✔ Direct orders allowed

Admin can reset if OTP stuck

---

## **🧠 WHY AUTO-SPLIT IS MANDATORY (YOUR SCENARIO)**

Consumer ordered:

Rice  
 Dal  
 Oil

But:

Seller A → Rice \+ Dal  
 Seller B → Oil only

So system must:

Create:

Master Order (Consumer View)  
 Sub-Order A → Seller A  
 Sub-Order B → Seller B

✔ Otherwise order impossible

---

# **DISCOVERY \+ STORE \+ SEARCH \+ OFFER SYSTEM**

## **🎯 CORE OBJECTIVE**

✔ Homepage এ প্রোডাক্ট লিস্ট দেখাবে  
 ✔ একই সাথে কোন কোন Seller বিক্রি করছে তা দেখা যাবে  
 ✔ Consumer Seller এর Store Page এ ঢুকতে পারবে  
 ✔ Product \+ Seller \+ Category — সব এক Search System থেকে  
 ✔ প্রতিটা Shop Owner এর থাকবে Public Store Page

---

## **✅ STEP–1: HOMEPAGE PRODUCT DISCOVERY**

### **Product Card Structure**

প্রতিটি Product Card এ থাকবে:

\[ Product Image \]  
 Product Name  
 Brand  
 Base Price (Platform Price)  
 Available Sellers Count (e.g. 3 Sellers)

Buttons:

\[ View Product \]  
 \[ View Sellers \]

---

### **View Sellers (Popup / Bottom Sheet)**

When user clicks **View Sellers**:

Seller Name  
 Distance  
 Seller Price  
 Rating  
 \[ Visit Store \]

👉 এখান থেকেই Store Page এ যাবে

---

## **✅ STEP–2: PRODUCT LIST PAGE (CATEGORY / SEARCH)**

### **When Category Selected**

Example: Category → Rice

System shows in same page:

🟩 Section–A: Rice Products Grid  
 🟦 Section–B: Sellers Selling Rice

---

### **Product List Card**

Product Card shows:

Product  
 Min Seller Price  
 Seller Count

Click:

→ Product Detail  
 → Seller List

---

### **Seller List Card**

Seller Card shows:

Store Name  
 Distance  
 Category Tags

Click:

→ Seller Store Page

---

## **✅ STEP–3: UNIFIED SEARCH SYSTEM**

### **Search Result Tabs**

\[ Products \] \[ Sellers \] \[ Categories \]

---

### **Products Tab**

Shows:

Product Card  
 Seller Count  
 Min Price

Click:

→ Product Detail  
 → Seller List

---

### **Sellers Tab**

Shows:

Seller Card  
 Distance  
 Category Tags

Click:

→ Seller Store Page

---

### **Categories Tab**

Shows:

Category Name  
 Seller Count

Click:

→ Category View  
 → Product \+ Seller sections together

---

## **✅ STEP–4: SELLER PUBLIC STORE PAGE (CONSUMER VIEW)**

### **Store URL**

bikalpo.com/store/{shop-slug}  
 QR Code → Same URL

---

### **Store Page Layout**

#### **Header Section**

Store Logo  
 Store Name  
 Tagline (Optional)  
 Rating ⭐⭐⭐⭐☆  
 Delivery Area  
 Open / Closed Status

Buttons:

\[ Call \]  
 \[ WhatsApp \]

---

#### **Navigation Tabs**

\[ Products \] \[ Offers \] \[ About Store \] \[ Reviews \]

---

## **✅ STEP–5: STORE PRODUCTS TAB**

### **Product Grid**

Each Product Card:

Product Image  
 Name  
 Seller Price  
 Stock Status  
 \[ Add to Cart \]  
 \[ View Details \]

✔ Only Admin-approved products  
 ✔ Only products inside assigned model  
 ✔ Only if stock available  
 ✔ Only if price updated within 24h

---

## **✅ STEP–6: STORE OFFERS TAB**

### **Offer Types**

Seller can show:

✔ Customer specific discount  
 ✔ Bundle offer  
 ✔ Time limited offer

If consumer logged in:

→ Personal offers shown

---

## **✅ STEP–7: ABOUT STORE TAB**

Shows:

Shop Address  
 Owner Name  
 Delivery Policy  
 Payment Options  
 Return Policy  
 Business Hours

---

## **✅ STEP–8: REVIEWS TAB**

Shows:

Customer Ratings  
 Comments  
 Photos

---

## **✅ STEP–9: SELLER INTERNAL DASHBOARD (POST LOGIN)**

Visible only to Seller

---

### **Dashboard Sections**

#### **📊 Overview**

Today Sales  
 Pending Orders  
 Total Customers

---

#### **📦 Products**

View allowed products  
 Set retail price  
 Stock visibility

---

#### **🧾 Orders**

Incoming orders  
 Open order accept  
 Delivery tracking

---

#### **🎁 Offers**

Schedule offers

---

#### **⚙️ Settings**

Store Profile  
 QR Download  
 Delivery Rules  
 Business Hours

---

## **✅ STEP–10: CONSUMER VISIBILITY RULES**

Consumer sees product only if:

✔ Product approved by Admin  
 ✔ Product in shop’s assigned model  
 ✔ Shop seller enabled  
 ✔ Stock available  
 ✔ Price updated today  
 ✔ Area permitted

---

## **✅ STEP–11: SELLER ACTIVATION RULE (RECAP)**

Seller must satisfy:

✔ seller\_status \= enabled  
 ✔ product allowed  
 ✔ area allowed  
 ✔ stock available  
 ✔ OTP pending \< 2 (for open order)

Only then:

→ Store products visible  
 → Can receive open order

---

# BIKALPO PLATFORM

# **Project Name:** Bikalpo.com

# **Type:** Location-Based Hybrid Marketplace Platform (B2B \+ B2C)

# **Business Flow:** Dealer (Super Seller) → Shop Owner → Consumer

---

**🏠 Dashboard**

Dashboard Overview

---

## **📊 Business Summary**

Net Sales  
 Total Purchases  
 Outstanding Dues  
 Net Profit / Loss

---

## **🛒 Sales & Orders**

Total Orders  
 Pending Orders  
 Delivered Orders  
 Sales Returns

---

## **👥 Customers & Suppliers**

Total Customers  
 New Customers (This Month)  
 Returning Customers  
 Suppliers

---

## **📦 Inventory Status**

Total Products  
 Low Stock Products  
 Expired Products  
 Recent Stock Adjustments

---

## **🔄 Stock Movement**

Today Stock In  
 Today Stock Out  
 Damaged Stock Today  
 Return Stock Pending

---

## **💰 Finance Snapshot**

Today Income  
 Today Expenses  
 Receivable Amount  
 Payable Amount

---

## **🏆 Performance Highlights**

Top Selling Products  
 Top Categories  
 Top Customers

---

## **⚠️ Alerts & Warnings**

Low Stock Alerts  
 Expiry Alerts  
 Pending Damage Reports  
 Price Update Required

---

## **🔔 Tasks & Follow-ups**

Pending Deliveries  
 Pending Returns  
 Pending Payments  
 Pending Purchase Orders

---

## **🚀 Quick Actions**

Create Sale  
 Add Purchase  
 Add Product  
 Add Stock  
 Add Customer  
 View Reports

---

## **📈 Trends & Growth**

Sales Trend  
 Customer Growth  
 Stock Consumption Trend

---

### **🔐 Role Based Display Rule (Important for Dev)**

Shop Owner sees:  
 All sections

Employee sees:  
 Sales & Orders  
 Inventory Status  
 Stock Movement  
 Quick Actions

Hide from Employee:  
 Finance Snapshot  
 Profit / Loss  
 Supplier Dues

Admin has separate dashboard (not this)

✅ DELIVERY ROLE TYPES — 

PLATFORM DELIVERY MAN (Monthly / Contract)

👉 Used for: B2B Orders (Super Seller → Shop Owner)

👉 Employer: Platform (Admin controlled)

🏠 Dashboard Overview

📦 Assigned Deliveries

Today’s Delivery List

Pickup Location (Warehouse)

Drop Location (Shop)

Order Priority

🗺️ Route & Navigation

Optimized Route Map

Stop Sequence

ETA per stop

📲 Delivery Actions

Start Trip

Arrived at Pickup

Picked Up (Scan QR)

Delivered (OTP / Signature)

♻️ Return Pickup (B2B)

Return Collection Requests

Damage Return Handling

Return Confirmation

📸 Proof & Compliance

Upload Delivery Photo

Upload Return Proof

Issue Reporting Button

📊 Work Summary

Today Completed Deliveries

Pending Tasks

On-time Delivery %

🔔 Notifications

New Assignment

Route Change

Urgent Pickup

❌ Hidden Completely

Sales

Stock

Prices

Customer List

Finance

Offers

SHOP / PARTNER DELIVERY MAN (External)

👉 Used for: B2C Orders (Shop → Consumer)

🏠 Dashboard Overview

🛒 Assigned Orders

Customer Deliveries

Open Order Deliveries

COD / Paid Tag

📍 Customer Details

Map Location

Call Button

📦 Pack Return Handling

Empty Pack Collection Required

Pack Proof Upload

💰 Payment Handling (If COD)

Collect Cash

Mark as Paid

📲 Delivery Confirmation

OTP / Customer Confirmation

Photo Upload

🕒 Task Timeline

Pending Deliveries

Completed Today

🛎 Notifications

New Order

Delivery Cancelled

Address Updated

❌ Hidden Completely

B2B Orders

Warehouse Pickup

Platform Stock

Other Shops

Platform Reports

🔁 COURIER COMPANY INTEGRATION MODE (Pathao / Steadfast)

---

**🧱 Inventory Master (Product Setup)**

Products  
 Create Product  
 Categories  
 Brands  
 Units  
 Variant Attributes  
 Warranties  
 Print Barcode  
 Print QR Code

---

**🔁 Variant & Conversion System**

Variant Management  
 Variant Conversion Rules  
 Conversion Rule Manager  
 Variant Conversion Monitor  
 Conversion Job Logs  
 Failed Conversion Alerts

---

**🏪 Catalog & Product Permission Control**

Product Assignment to Shops  
 Product–Variant Assignment to Shops  
 Product Model Assignment  
 Variant Inclusion Rules  
 Variant Availability Matrix (Shop vs Variant)  
 Product Sell Permission  
 Product Approval Queue  
 Unauthorized Product Attempt Logs  
 Shop Catalog Auto Sync Logs  
 Product Request from Shop  
Product Request Approval Queue  
Rejected Product Request Logs  
---

**📊 Inventory Audit & Safety (Admin)**

Low Stocks  
 Expired Products  
 Damage Audit Dashboard  
 Abnormal Damage Alerts  
 Manual Stock Correction (with reason)  
 Reservation Mismatch Detector

---

**♻️ Pack Return & Deposit Control**

Pack Return Configuration (Default – Admin)  
 Allowed Pack Brand Manager  
 Allowed Pack Size Manager  
 Pack Deposit Configuration  
 Shop Pack Rule Override  
 Pack Return Violation Logs

---

**📦 Sales Model Management**

Sales Model Manager  
 Model Product Mapping  
 Shop–Model Assignment  
 Model Performance Report

---

**📍 Market Intelligence (Product Demand)**

Product Availability by Area  
 Product Demand Without Supply  
 Seller Activation Requests (Product Level)

---

**📊 Stock Overview & Movement**

Stock  
 Stock Transfer  
 Stock Ledger Viewer (Read Only)

---

**🧾 Stock Adjustment & Audit**

Stock Adjustment Requests (Shop)  
 Adjustment Approval Queue (Admin)  
 Manual Stock Adjustment (Admin)  
 Stock Audit Logs

---

**🚨 Damage Reporting & Control**

Damage Reporting Panel (Shop)  
 Damage Adjustment Requests (If approval needed)  
 Stock Damage Logs (Read Only)  
 Damage from Returns Log (Admin)

---

**♻️ Return → Inventory Reconciliation**

Return Stock Approval  
 Return–Inventory Reconciliation

---

**🛒 Sales** 

Sales History  
 Sales Return

---

**🧾 Purchases (B2B)**

Purchases  
 Purchase Return  
Create Custom Bill  
---

**🎯 Promo (Basic)**

Coupons  
 Gift Cards

---

**🧠 Offer Management — Admin Only**

Offer Template Library  
 Offer Rule Builder  
 Offer Validity Scheduler  
 Offer Abuse Monitor  
 Offer Performance Dashboard

---

**🏪 Seller Promotions Panel**

Available Offer Library (Read Only)  
 Active Offers Toggle (ON / OFF)  
 Offer Eligibility Checker  
 Offer Deactivation History

---

**🧾 Financial Overview**

Financial Overview  
 Accounts List  
 Transactions List  
 Account Statement

---

**📉 Income & Expense Management**

Expenses  
 Expense Categories  
 Income  
 Income Categories

---

**📊 Core Accounting Reports**

Balance Sheet  
 Trial Balance  
 Cash Flow

---

**💸 Pricing & Margin Control System**

Base Price Rules (Admin)  
 Min–Max Price Bands  
 Shop Price Update Logs  
 Daily Price Review Tracker  
 Price Deviation Alerts  
 Seller Price Violation Monitor

---

**🎯 Discount, Offer & Subsidy Accounting**

Discount Cost Allocation Report  
 Offer Impact on Margin Report  
 Seller Subsidy Ledger

---

**🔁 Return, Refund & Deposit Accounting**

Credit Note Management  
 Return Refund Ledger  
 Refund Settlement Report  
 Pack Deposit Ledger  
 Deposit Refund Processor  
 Deposit Forfeit Records

---

**📈 Advanced Financial Analytics**

Negotiation Price Deviation Report  
 Platform vs Seller Margin Report

---

**👥 Contacts**

Customers  
 Suppliers

---

**🗺️ Area & Zone Management**

Area Polygon Manager  
 Service Availability Zones  
 Area Coverage Gaps Report

---

**🏪 Seller Area Permission & Mapping**

Seller Area Mapping  
 Seller Area Permission Control  
 Radius Permission Control

---

**📏 Radius & Matching Rules**

Radius Rule Settings  
 Radius Rule Tester

---

**🧾 Order ↔ Area Matching Logs**

Order–Area Matching Logs

---

**📊 Geo Intelligence & Performance**

Seller Density Heatmap  
 Area Based Offer Targeting  
 Area Offer Performance Stats

---

**⚙️ Platform Configuration**

Payment Gateway  
 Shipping & Delivery  
 SMS Support (Order Notifications)  
 Subscription

---

**📝 Seller Onboarding & Verification**

Seller Approval Queue  
 Seller Verification Status  
 Seller Onboarding Checklist

---

**⚙️ Seller Controls**

Seller Status Control (Enable / Disable)  
 Temporary Seller Suspension  
 Seller Reactivation Requests

---

**🧭 Seller Permission & Capability**

Seller Area Permission  
 Seller Category Restriction  
 Shop Type Rules (Restaurant / Retail)  
 Seller Capability Flags (Open Order / B2C / B2B)

---

**🚨 Seller Compliance & Monitoring**

Seller Violation History

---

**👥 Employee Directory**

Employees  
 Sales Representatives  
 Departments  
 Designations

---

**📥 Employee Onboarding & Security**

Employee Invitation System  
 Role Auto Assignment Rules  
 Employee Login Activity  
 Employee Access Revocation

---

**🕒 Workforce Management**

Shifts  
 Attendance  
 Leaves

---

**🧱 Roles & Permissions**

User Roles Management  
 Role Permission Matrix  
 Feature Access Control  
 Area Based Permission Mapping  
Shop Type Behavior Rules (Retail vs Restaurant)  
---

**👤 Role Assignment**

Employee Role Assignment  
 SR Roles

---

**📊 Campaign Management**

SMS Overview  
 SMS Templates  
 Packages

**🚀 Sending Tools**

Quick Send  
 Group Send  
 Groups

**⏰ Automation & Alerts**

Due Reminder  
 EMI Reminder

**🧾 Logs & History**

SMS History

---

**🛒 Sales Reports**

Sales Report  
 Best Selling  
 Open Order Conversion Rate  
 Average B2B Cart Value  
 Failed B2B Checkout Rate  
 MOQ Impact on Order Volume

---

**📦 Purchase & Stock Reports**

Purchase Report  
 Stock Report  
 Stock Movement Report  
 Inventory Accuracy Report  
 Conversion Loss Report

---

**🏭 Supplier Reports**

Supplier Report  
 Supplier Due Report

---

**👥 Customer Reports**

Customer Report  
 Customer Due Report

---

**📦 Product Reports**

Product Report  
 Product Expiry Report  
 Product Quantity Report  
 Product Model Performance

---

**💰 Finance Reports**

Expense Report  
 Income Report  
 Profit & Loss Report

---

**🎯 Offer, Discount & Promotion Reports**

Offer Redemption Report  
 Offer Conversion Funnel  
 Discount Leakage Report

---

**🔐 Compliance & Violation Reports**

Seller Compliance Report  
 Price Violation Report  
 Area Violation Report  
 Category Restriction Violations  
 Price Deviation Analytics

---

**♻️ Return, Damage & Pack Reports**

Pack Return Rate by Product  
 Brand-wise Pack Return Stats  
 Deposit Loss Report  
 Damage Rate by Shop  
 Damage by Product / Variant  
 Damage Trend Over Time

---

**📍 Marketplace & Service Health Reports**

No-Seller Encounter Rate  
 Open Order Expiry Reasons  
 Order Rejection Analytics  
 OTP Failure Rate by Seller  
 Service Search Failure Rate  
 Invite Click-to-Signup Conversion

---

**🧑‍💼 User Onboarding & Workforce Reports**

Seller Application Funnel  
 Approval Time SLA  
 Employee Activity Report

---

**👥 USER ONBOARDING & ROLE CONTROL (ADMIN MODULE)**

Business Account Applications  
 Document Verification Queue  
 Role Upgrade Requests  
 Role Change History  
 Rejected Applications Archive

---

**🔐 ROLE & PERMISSION RULES (ADMIN SETTINGS)**

System Role Lock Rules  
 Role Upgrade API Rules  
 Feature Access Matrix

---

**🎁 OTHERS — FINAL CLEAN MENU**

Refer & Earn  
 Affiliate Dashboard  
 Recycle Bin  
 Trash

---

**🧑‍💼 Role & Onboarding Policy**

Default Role Policy  
 Auto Lock After Rejection Rules  
 Reapply Waiting Period  
 Seller Default Permissions  
 Model Assignment Rules

---

**🟦 B2B Order Policy**

Enable / Disable B2B MOQ Rule  
 Hard Block vs Soft Warning Mode  
 Minimum B2B Order Amount Settings  
 Category-wise B2B Minimum Rules  
 Temporary B2B Relaxation Campaigns

---

**🤖 Open Order & Negotiation Policy**

Negotiation Timeout Config  
 Auto Re-Broadcast Rules  
 OTP Expiry Policy  
 Reservation Timeout Rules

---

**📦 Inventory & Conversion Rules**

Auto Conversion Rules  
 Ledger Retention Policy  
 Reservation Mismatch Auto Check Rules

---

**♻️ Return, Refund & Pack Policy**

Return Window Configuration  
 Auto-Approval Rules  
 Pack Deposit Rules  
 Default Pack Deposit Rules  
 Pack Dispute Time Window  
 Auto Refund Rules  
 Fraud Detection Thresholds

---

**🎯 Offer & Promotion Rules**

Offer Stacking Rules  
 Best Offer Selection Policy  
 Offer Cooldown Rules

---

**⚠️ Damage & Abuse Control**

Damage Reason Master  
 Daily Damage Threshold Rules  
 Auto Flag Rules

---

**📣 Consumer Message & Recruitment Logic**

Message Escalation Timers  
 Invite CTA Enable Rules  
 Auto Recruitment Alerts

---

**🛡 Seller Risk & Suspension Policy**

Auto Suspension Thresholds

---

**🏪 SHOP OWNER MANAGEMENT (Admin Panel)**

**🏪 Shop & Seller Control**

Shop Owner List  
 Shop Verification & Documents  
 Seller Enable / Disable  
 Shop Type Control (Restaurant / Retail)  
 Shop Area Assignment  
 Seller Capability Flags (B2B / B2C / Open Order)

---

**⚙️ GENERAL APP SETTINGS (Visible to All Roles)**

Delivery Settings  
 Financial Settings  
 Promotional Settings  
 Account Settings

---

**⚠️ HIGH-RISK ADMIN ACTIONS**

Shop Reset  
 Manual Ledger Override  
 Emergency Feature Kill Switch

---

**🔴 Live Operations**

Open Order Pool (Live Feed)  
 Seller Accept / Reject Panel  
 Negotiation Window Monitor  
 Rejected Offer Tracker

---

**⚙️ Matching & Eligibility Engine**

Seller Eligibility Filter Engine  
 Auto Match Engine  
 Seller Matching Debugger  
 Area Match Debug Panel

---

**🧾 Assignment & Routing Logs**

Open Order Assignment Logs  
 Seller Assignment History  
 Order Routing Engine  
 Open Order Assignment Flow

---

**🔐 OTP & Load Control**

Seller OTP Queue Monitor  
 OTP Limit Controller  
 Manual OTP Reset (Admin)  
 Seller Active Load Monitor  
 OTP Verification Log  
Seller Negotiation Lock Monitor  
Blocked Seller Reason Viewer  
---

**📦 Order State & Pricing**

Order State Timeline (order\_events viewer)  
 Order Lock Monitor  
 Expired / Timeout Orders  
 Order Price Snapshot Viewer

---

**🧮 Inventory & Stock Link**

Inventory Reservation Monitor  
 Order–Stock Traceability View  
 Damage Linked to Order View

---

**🛒 B2B Compliance**

B2B Order Validation Logs  
 Blocked B2B Order Attempts  
 B2B Cart Compliance Checker

---

**🔁 Cancel & Return Eligibility**

Cancel vs Return Eligibility Panel  
 Order Return Eligibility Check  
 Order–Return Link Viewer

---

**🎯 Offer & Discount on Order**

Applied Offer Viewer  
 Discount Breakdown Panel  
 Offer Snapshot Viewer

---

**♻️ Pack & Deposit on Order**

Order Pack Info Viewer  
 Pack Deposit Status Panel  
 Pack Return Confirmation Log

---

**📦 Return Processing**

Return Requests Queue  
 Return Inspection Panel  
 Return Status Tracker  
 Refund & Credit Processing  
 Replacement Orders

---

**🚚 Pickup & Delivery Integration**

Pickup Scheduling  
 Return Pickup Tasks  
 Failed Pickup Alerts  
 Delivery Return Proofs

---

**♻️ Pack Return & Deposit Disputes**

Pack Return Dispute Panel  
 Deposit Adjustment Requests  
 Failed Pack Collection Alerts

---

**🛡 Seller Risk & Control**

Seller Inventory Permission  
 External Stock Tag Review  
 Seller Stock Abuse Alerts  
 Seller Auto-Block Rules  
 Seller Penalty Rules  
 Return Abuse Flags

---

**📊 Seller Load & Order Limits**

OTP Load Dashboard  
 Seller Order Acceptance Limits  
 High-Risk Shop MOQ Enforcement Level  
 Shop-wise B2B Threshold Override

---

**📣 Seller Growth & Recruitment**

Consumer Invite Requests  
 Invited Seller Conversion Tracker  
 Area Recruitment Priority List

---

**🎯 Seller Promotion Control**

Seller Boost Campaigns  
 Offer Eligibility by Seller Rules  
 Suspended Offer Access Logs

---

**👁 Visibility Rules**

Shop Visibility Rules  
 Product Visibility Rules  
 Area Product Availability

---

**📲 Mobile App Behavior**

App Home Routing Rules  
 Dynamic Menu by Role  
 Hidden Feature Flags

---

**📣 USER FEEDBACK & NOTIFICATION SYSTEM**

Reason-Aware Notification Templates  
 Time-Based Message Rules Engine  
 Consumer Alert Delivery Logs  
 Failed Availability Scenarios Tracker

# Project Brief

# **Project Brief**

## **Project Name: Bikalpo.com**

## **Type: Location Based Multi-Vendor Marketplace (B2B \+ B2C)**

**Dealer (Admin / Super Seller) → Shop Owner (B2B)**  
**Shop Owner → Consumer (B2C)**

# User Role

**User Role Architecture – Buyer & Seller Split Model** 

---

**🧱 Primary Roles (System Level)**

1. Admin (Super Seller)

2. Shop Owner (Business User)

3. Consumer (End User)

4. Employee (Salesman / Delivery)

---

---

## **🎭 Role vs Capability Matrix**

| User Type | Buyer | Seller | Notes |
| ----- | ----- | ----- | ----- |
| Admin | ❌ | ✅ (B2B Only) | Sells to Shop Owners |
| Shop Owner (Seller Enabled) | ✅ (B2B Buyer) | ✅ (B2C Seller) | Admin approved |
| Shop Owner (Buyer Only – e.g. Restaurant) | ✅ | ❌ | Cannot sell to consumers |
| Consumer | ✅ (B2C Buyer) | ❌ | Cannot sell |
| Employee | ❌ | ❌ | Operational only |

---

**🧠 Seller Eligibility Rules**

Only Admin can approve a Shop Owner as Seller

Some Shop Owners may be Buyer-only

Restaurant type cannot sell platform products

Seller approval required to receive B2C orders

---

**📦 Product Selling Permission**

Shop Owner can sell only:

✔ Products assigned by Admin

✔ Products inside assigned product model

✔ Products currently in stock

---

**📊 Stock Update Permission**

Shop Owner can:

✔ Report damage

✔ Adjust stock downward with reason

✔ View stock

Shop Owner cannot:

❌ Add new product manually (can send request Add new product )

---

**💰 Pricing Responsibility**

Shop Owner must:

✔ Review prices daily (once per 24h minimum) \- when open the shop in morning

✔ Can update anytime

Admin defines base pricing rules

Consumer sees:

\- Admin base price (home page)

\- Shop owner selling price (in Shop owner page)

---

**🤖 Open Order Participation Permission**

Only shop owners with:

✔ is\_seller \= true

✔ seller\_status \= approved

✔ can\_accept\_open\_order \= true

✔ Area permission matched

✔ Product permission matched

Can receive Open Order notifications

---

## **🔐 OTP Load Control Rule**

Each Seller can have max 2 pending OTP confirmations at a time.

If limit reached:

 \- New Open Orders not pushed (admin can reset this rules when they forget the opt )

 \- Direct orders allowed

---

**🔄 Buyer–Seller Mapping in Orders**

### **🟦 B2B Order**

Buyer  → Shop Owner

Seller → Admin (Super Seller)

---

**🟢 B2C Direct Order**

Buyer  → Consumer

Seller → Shop Owner (approved seller only)

---

**🤖 Open Order**

Buyer  → Consumer

Seller → NULL initially

After accept:

Seller → Approved Shop Owner

---

## **📍 Area Permission Rule**

Shop Owner can:

✔ View orders only inside assigned area

✔ Receive open orders only inside permitted radius

---

# product\_variants

## **📦 Variant Definitions**

---

**🔵 Variant V1 — B2B Bulk Sack (Loose)**  
SKU: AT-IF-L-2001  
Variant Type: TRADE  
Pack Type: Sack (Loose)  
Pack Weight: 50 KG  
Pack Count Inside: 1  
Sell Unit: Sack  
Order Type: B2B  
Min Order: 1 Sack  
Max Order: 5 Sack  
Price: ৳XXXX / Sack  
Stock Source: Super Seller Inventory  
Delivery Type: Weight Based  
Visibility Role: shop\_owner  
Linked Retail Variant: V4 (Loose Retail)  
 

---

**🔵 Variant V2 — B2B Carton Pack (Retail Inside)**  
SKU: AT-IF-L-2002  
Variant Type: TRADE  
Pack Type: Carton  
Pack Weight: 50 KG  
Pack Count Inside: 10  
Inner Pack Size: 5 KG  
Sell Unit: Carton  
Order Type: B2B  
Min Order: 1 Carton  
Max Order: 5 Carton  
Price: ৳XXXX / Carton  
Stock Source: Super Seller Inventory  
Delivery Type: Invoice / Amount Based  
Visibility Role: shop\_owner  
Linked Retail Variant: V3 (5kg Retail Pack)

✔️ Carton ভাঙলে 5kg retail packs হবে।

---

**🟢 Variant V3 — B2C Retail Pack (Sealed)**

SKU: AT-IF-L-3001  
Variant Type: RETAIL  
Pack Type: Packet (Sealed)  
Pack Weight: 5 KG  
Pack Count Inside: 1  
Sell Unit: Packet  
Order Type: B2C  
Min Order: 1 Packet  
Max Order: 20 Packet  
Price: ৳XX / Packet  
Stock Source: Shop Inventory  
Delivery Type: Zone Based  
Visibility Role: consumer  
---

**🟢 Variant V4** 

---

---

## **🤖 Open O**

## **product\_variants**

id  
product\_id  
sku

variant\_type              (trade / retail)  
pack\_type                 (sack / carton / packet / loose)

pack\_weight\_kg  
inner\_pack\_size\_kg  
pack\_count\_inside

sell\_unit  
order\_type                (B2B / B2C)

min\_order  
max\_order

base\_price                (Admin controlled)  
shop\_selling\_price        (Shop editable)

price\_last\_updated\_at

min\_margin\_percent  
min\_margin\_amount

visibility\_role  
stock\_source              (super\_seller / shop)

delivery\_type  
delivery\_rule\_id

linked\_retail\_variant\_id  
conversion\_ratio  
conversion\_loss\_percent

is\_open\_order\_allowed     (true/false)  
negotiation\_timeout\_sec   (default 100\)

is\_pack\_return\_required   (true/false)  
pack\_deposit\_amount

status  
created\_at  
updated\_at

---

---

# **🧠 Pricing Rules**

### **Admin**

✔ Sets base\_price  
 ✔ Defines delivery rules

### **Shop Owner**

✔ Sets shop\_selling\_price  
 ✔ Must update at least once every 24h  
 ✔ Can update anytime

---

---

 **Open Order Rules**

If is\_open\_order\_allowed \== true:  
    Price negotiation enabled (100 sec default)  
Else:  
    Negotiation disabled

If seller.active\_open\_orders \>= 2:  
    Do not push new open orders

---

---

# **♻️ Pack Return Rules**

If is\_pack\_return\_required \== true:  
    Consumer must input old pack info  
    Deposit applied if pack missing

Order captures:

old\_pack\_brand  
old\_pack\_size  
new\_pack\_brand  
new\_pack\_size  
pack\_deposit\_applied  
pack\_deposit\_amount

---

---

# **🚚 Delivery Rules**

delivery\_rule\_id links to:  
\- Weight based  
\- Distance based  
\- Floor based

Order captures:

delivery\_floor\_no

---

---

# **👁️ UI Visibility Logic**

If user.role \== shop\_owner:  
    show TRADE variants only

If user.role \== consumer:  
    show RETAIL variants only

# **FINAL UPDATED VARIANT SPECIFICATION (Clean Version)**

আপনি এটা সরাসরি ডেভেলপারকে দিতে পারবেন ✅

---

# **📦 Product Variant Architecture (Final)**

## **product\_variants**

id  
product\_id  
sku

variant\_type              (trade / retail)  
pack\_type                 (sack / carton / packet / loose)

pack\_weight\_kg  
inner\_pack\_size\_kg  
pack\_count\_inside

sell\_unit  
order\_type                (B2B / B2C)

min\_order  
max\_order

base\_price                (Admin controlled)  
shop\_selling\_price        (Shop editable)

price\_last\_updated\_at

min\_margin\_percent  
min\_margin\_amount

visibility\_role  
stock\_source              (super\_seller / shop)

delivery\_type  
delivery\_rule\_id

linked\_retail\_variant\_id  
conversion\_ratio  
conversion\_loss\_percent

is\_open\_order\_allowed     (true/false)  
negotiation\_timeout\_sec   (default 100\)

is\_pack\_return\_required   (true/false)  
pack\_deposit\_amount

status  
created\_at  
updated\_at

---

---

# **🧠 Pricing Rules**

### **Admin**

✔ Sets base\_price  
 ✔ Defines delivery rules  
 ✔ Sets minimum margin rules

### **Shop Owner**

✔ Sets shop\_selling\_price  
 ✔ Must update at least once every 24h  
 ✔ Can update anytime

### **Validation**

shop\_selling\_price \>= base\_price \+ minimum\_margin

---

---

# **🤖 Open Order Rules**

If is\_open\_order\_allowed \== true:  
    Price negotiation enabled (100 sec default)  
Else:  
    Negotiation disabled

If seller.active\_open\_orders \>= 2:  
    Do not push new open orders

---

---

# **♻️ Pack Return Rules**

If is\_pack\_return\_required \== true:  
    Consumer must input old pack info  
    Deposit applied if pack missing

Order captures:

old\_pack\_brand  
old\_pack\_size  
new\_pack\_brand  
new\_pack\_size  
pack\_deposit\_applied  
pack\_deposit\_amount

---

---

# **🚚 Delivery Rules**

delivery\_rule\_id links to:  
\- Weight based  
\- Distance based  
\- Floor based

Order captures:

delivery\_floor\_no

---

---

# **👁️ UI Visibility Logic**

If user.role \== shop\_owner:  
    show TRADE variants only

If user.role \== consumer:  
    show RETAIL variants only

---

---

# **🔐 Seller Eligibility Validation**

Before allowing sale:

✔ shop.is\_seller\_enabled \== true  
✔ shop is approved  
✔ shop allowed product model  
✔ variant active  
✔ stock available  
✔ price updated within 24h  
✔ margin rules satisfied

## **🎯 Core Philosophy (আপনার আইডিয়া অনুযায়ী)**

✔ Product ও Variant সবার জন্য এক  
 ✔ SKU একই থাকবে Super Seller \+ Seller দুজনের জন্য  
 ✔ পার্থক্য হবে শুধু:

* Stock Owner

* Available Qty

* Selling Price

* Empty Pack Rule (Seller override)

✔ Conversion system auto কাজ করবে  
 ✔ Pack return rule product level এ থাকবে, কিন্তু seller override করতে পারবে

---

# **🧱 1️⃣ Product (Master Data – Global)**

### **📦 products**

id  
name  
category\_id  
brand\_id

description

is\_returnable\_pack (true/false)        ← default rule  
default\_pack\_deposit\_amount

allowed\_pack\_brands (json)  
allowed\_pack\_sizes (json)

status  
created\_at

👉 এগুলো **সব inventory owner এর জন্য same থাকবে**।

---

# **🧱 2️⃣ Product Variants (Shared by All)**

### **📦 product\_variants**

id  
product\_id  
sku

variant\_type (TRADE / RETAIL)

pack\_type (sack / carton / packet / loose)

pack\_weight\_kg  
inner\_pack\_size\_kg  
pack\_count\_inside

sell\_unit  
order\_type (B2B / B2C)

min\_order  
max\_order

base\_price                ← Super Seller default price

visibility\_role (shop\_owner / consumer)

delivery\_type  
delivery\_rule\_id

linked\_retail\_variant\_id  
conversion\_ratio

is\_open\_order\_allowed

status

### **✅ Important Rule**

এই Variant:

* Super Seller inventory তেও থাকবে

* Seller inventory তেও থাকবে

* SKU সব জায়গায় same

---

# **🧱 3️⃣ Inventory (Owner Based Only)**

### **📦 inventories**

id  
owner\_type (super\_seller / shop)  
owner\_id

variant\_id

available\_qty  
reserved\_qty

updated\_at

👉 Product/Variant same  
 👉 শুধু owner \+ qty আলাদা

---

# **🔁 4️⃣ Variant Conversion System**

### **📦 variant\_conversion\_map**

from\_variant\_id  
to\_variant\_id  
conversion\_ratio  
auto\_convert (true/false)

### **🧠 Example**

| From (Trade) | To (Retail) | Ratio |
| ----- | ----- | ----- |
| Carton | 5kg Pack | 10 |
| Sack | Loose KG | 50 |

### **🟦 B2B Order Flow**

Super Seller Stock:  
 \-2 Carton

Shop Trade Inventory:  
 \+2 Carton

Auto Convert:  
 \-2 Carton  
 \+20 Retail Packs

---

# **💰 5️⃣ Price Model (Different per Owner)**

### **🧠 Rules**

✔ Super Seller sets base selling price  
 ✔ Shop Owner sets own selling price  
 ✔ Consumer sees:

* Platform price

* Seller price

✔ Daily price update enforcement possible

---

# **♻️ 6️⃣ Empty Pack Return Configuration (Override System)**

### **📦 product\_pack\_rules**

id  
product\_id

owner\_type (super\_seller / shop)  
owner\_id

is\_empty\_pack\_returnable  
empty\_pack\_value

updated\_at

### **🧠 Priority Logic**

If shop rule exists:  
    use shop rule  
Else:  
    use super seller default rule  
Else:  
    use product default

### **✅ Meaning**

* Super Seller product add করলে rule সেট করবে

* Seller চাইলে নিজের জন্য change করতে পারবে

* Consumer product page এ final rule দেখবে

---

# **🛒 7️⃣ Order Time Pack Flow**

If final rule \= returnable:

UI:

Do you have old pack?  
YES / NO

If NO:

order\_total \+= empty\_pack\_value

Delivery:

Did customer return pack?  
YES / NO

Ledger:

* If NO → deposit kept

* If YES → no charge  
---

✅ MASTER UNIT / PACK / SIZE VARIANT LIST (Admin Controlled)

🧮 Weight Based Units (ওজন ভিত্তিক)

gm — Gram

kg — Kilogram

👉 ব্যবহার: চাল, ডাল, চিনি, আটা, loose পণ্য

🧴 Liquid Based Units (তরল ভিত্তিক)

ml — Milliliter

L — Liter

👉 ব্যবহার: তেল, পানি, জুস, কেমিক্যাল

📦 Pack / Container Based Units

pkt — Packet

pch — Pouch

sch — Sachet

tb — Tub

tbe — Tube

tn — Tin

jr — Jar

btl — Bottle

cn — Can

👉 ব্যবহার: তেল, কসমেটিক, সস, পাউডার, কেমিক্যাল

📦 Bulk & Wholesale Packaging

sk — Sack (বস্তা)

ctn — Carton

bx — Box

👉 ব্যবহার:

TRADE Variant (B2B)

Wholesale supply

🔢 Quantity Based Units

pc — Piece

dz — Dozen

rl — Roll

👉 ব্যবহার: সাবান, টিস্যু, প্লাস্টিক, স্টেশনারি

🧠 IMPORTANT ARCHITECTURE RULE (আপনার সিস্টেম অনুযায়ী)

ডেভেলপারকে বলবেন 👇

✅ Unit হবে Master Table (Admin Controlled)

units\_master

id

code

name

unit\_type

1

kg

Kilogram

weight

2

ml

Milliliter

liquid

3

pkt

Packet

pack

4

sk

Sack

bulk

5

pc

Piece

count

✅ Variant Level এ Unit Assign হবে

product\_variants

variant\_id

unit\_id (FK from units\_master)

pack\_size\_value (যেমন: 5, 10, 50\)

variant\_type (TRADE / RETAIL)

Example

SKU

Variant

Unit

Size

AT-1001

Trade Sack

sk

50 kg

AT-1001

Retail Pack

pkt

5 kg

AT-1001

Retail Loose

kg

1 kg

# Inventory

# **1\. Inventory Architecture (Single Source of Truth)**

Dealer Inventory  
      ↓ (B2B Sale)  
Shop Trade Inventory  
      ↓ (Auto Conversion)  
Shop Retail Inventory  
      ↓ (B2C Sale)  
Consumer

👉 প্রতিটি স্টকের আলাদা Owner থাকবে।

---

### **🎯 Inventory Ownership**

| Owner Type | Stock Used For |
| ----- | ----- |
| Super Seller | B2B Sell |
| Shop Owner | B2C Sell |
| System (Virtual) | Conversion Buffer |

---

**🗃️ 2\. Database Structure (Production Ready)**  
---

**📦 inventories (Current Stock Snapshot)**  
inventories  
\------------  
id  
owner\_type (Super Seller / shop)  
owner\_id  
variant\_id  
available\_qty  
reserved\_qty  
damaged\_qty  
updated\_at  
---

**📜 stock\_ledger (Immutable History)**  
stock\_ledger  
\-------------  
id  
variant\_id  
owner\_type  
owner\_id  
change\_type (IN / OUT / CONVERT\_IN / CONVERT\_OUT / ADJUST)  
qty  
reference\_type (order / invoice / conversion / return / manual)  
reference\_id  
balance\_after  
created\_at  
---

**🔁 variant\_conversion\_map**  
variant\_conversion\_map  
\-----------------------  
from\_variant\_id  
to\_variant\_id  
conversion\_ratio  
auto\_convert (true/false)  
---

**🔄 3\. Stock Flow Scenarios**  
---

**🟦 Scenario–1:** Super Seller **→ Shop (B2B Order)**

### **Example**

Shop orders:

2 Carton (50kg each)

### **System Actions**

Dealer Inventory:  
\-2 Carton (OUT)

Shop Trade Inventory:  
\+2 Carton (IN)

Auto Conversion Triggered:  
2 Carton × 10 Packs \= \+20 Retail Packs

Shop Retail Inventory:  
\+20 Pack (CONVERT\_IN)

Shop Trade Inventory:  
\-2 Carton (CONVERT\_OUT)

✔️ Carton disappears from shop  
 ✔️ Retail stock becomes sellable

---

**🟢 Scenario–2: Shop → Consumer (B2C Sale)**

Consumer buys:

3 Pack (5kg)

### **System Actions**

Shop Retail Inventory:  
\-3 Pack (OUT)

Ledger entry created  
---

**🔁 Scenario–3: Loose Conversion (Bulk Sack → Loose KG)**

Shop buys:

1 Sack (50kg loose)

### **System**

Dealer: \-1 Sack  
Shop Trade: \+1 Sack  
Auto Convert:  
\+50 KG Loose Retail  
\-1 Sack Trade

---

---

## **♻️ Scenario–4: Return / Adjustment**

### **Consumer Return**

Shop Retail Inventory \+Returned Qty  
Ledger: RETURN\_IN  
---

**🔐 4\. Stock Locking & Safety Rules**  
---

**🔒 Reservation Logic**

When order placed:

available\_qty decreases  
reserved\_qty increases

When order confirmed:

reserved\_qty decreases  
OUT confirmed

When order cancelled:

reserved\_qty → available\_qty  
---

**🖥️ 5\. Admin / Shop UI Behavio**

---

**🧑‍💼** Super Seller **Dashboard**

* View:

  * Stock by Variant

  * Low stock alerts

  * Ledger history

* Actions:

  * Manual adjustment

  * Import stock

  * Audit logs

---

### **🏪 Shop Owner Dashboard**

* View:

  * Retail Stock

  * Sales Outflow

  * Conversion history (read-only)

* No manual edit allowed

---

# **📦 Inventory Architecture – Single Source of Truth (Updated)**

---

## **🔄 Stock Flow Chain**

Super Seller Inventory  
      ↓ (B2B Sale)  
Shop Trade Inventory  
      ↓ (Auto Conversion)  
Shop Retail Inventory  
      ↓ (B2C Sale)  
Consumer

✔ প্রতিটি স্টকের আলাদা Owner থাকবে  
 ✔ কোনো স্টক ডুপ্লিকেট হবে না  
 ✔ সব movement ledger দ্বারা ট্র্যাক হবে

---

---

## **🎯 Inventory Ownership**

| Owner Type | Purpose |
| ----- | ----- |
| Super Seller | B2B Sell |
| Shop Owner | B2C Sell |
| System (Virtual) | Conversion Buffer |

---

---

## **🗃️ Database Structure**

### **📦 inventories (Live Snapshot)**

inventories  
\------------  
id  
owner\_type (super\_seller / shop)  
owner\_id  
variant\_id  
available\_qty  
reserved\_qty  
updated\_at

🚫 damaged\_qty column removed  
 👉 Damage directly reduces available\_qty

---

---

### **📜 stock\_ledger (Immutable Audit)**

stock\_ledger  
\-------------  
id  
variant\_id  
owner\_type  
owner\_id  
change\_type   
    (IN / OUT / CONVERT\_IN / CONVERT\_OUT / DAMAGE / RETURN / ADJUST)

qty  
reason  
reference\_type (order / return / damage / manual)  
reference\_id  
balance\_after  
created\_at

✔ Every stock change MUST write ledger  
 ✔ Ledger cannot be edited or deleted

---

---

### **🔁 variant\_conversion\_map**

from\_variant\_id  
to\_variant\_id  
conversion\_ratio  
auto\_convert (true/false)

---

---

## **🔄 Stock Flow Scenarios**

---

### **🟦 Scenario–1: Super Seller → Shop (B2B Order)**

Shop orders 2 Carton

Super Seller Inventory:  
\-2 Carton (OUT)

Shop Trade Inventory:  
\+2 Carton (IN)

Auto Conversion:  
\+20 Retail Pack (CONVERT\_IN)  
\-2 Carton Trade (CONVERT\_OUT)

Retail stock becomes sellable

---

---

### **🟢 Scenario–2: Shop → Consumer (B2C Sale)**

Consumer buys 3 Pack

Shop Retail Inventory:  
\-3 Pack (OUT)

Ledger entry created

---

---

### **🔁 Scenario–3: Loose Conversion**

Shop buys 1 Sack (50kg)

Auto Convert:  
\+50 KG Loose Retail  
\-1 Sack Trade

---

---

### **♻️ Scenario–4: Return**

If resellable:  
\+Returned Qty (RETURN)

If damaged:  
No stock added  
Damage ledger entry

---

---

### **⚠️ Scenario–5: Damage Reporting**

Shop reports damage: 2 Pack

available\_qty \= available\_qty \- 2

Ledger:  
change\_type \= DAMAGE  
reason \= user input

---

---

## **🔐 Stock Locking & Safety Rules**

Order Placed:  
available\_qty ↓  
reserved\_qty ↑

Order Confirmed:  
reserved\_qty ↓ (OUT)

Order Cancelled / Expired:  
reserved\_qty → available\_qty

---

### **🔒 OTP Safety Lock**

If seller has 2 pending OTP orders:  
Inventory cannot be reserved for new Open Orders

---

---

## **🧑‍💼 Stock Permission Model**

### **✅ Shop Owner Can**

✔ View stock  
✔ Report damage  
✔ Reduce stock with reason  
✔ View ledger (read-only)

---

### **❌ Shop Owner Cannot**

❌ Add new product  
❌ Edit ledger

---

---

### **🧑‍💼 Admin Can**

✔ Manual correction  
✔ Stock import  
✔ Adjustment approval  
✔ Full audit access

---

---

## **🏷️ External Stock Handling (Optional Tag Only)**

If shop buys product outside platform:  
 \- Can tag as External Stock (read-only label)  
 \- Cannot increase platform inventory  
 \- Cannot sell unless Admin approves mapping

👉 Prevents fake stock inflation.

---

---

## **🖥️ UI Behavior**

---

### **🧑‍💼 Super Seller Dashboard**

View:

✔ Stock by variant  
✔ Low stock alerts  
✔ Ledger history

Actions:

✔ Import stock  
✔ Manual adjustment  
✔ Audit logs

---

---

### **🏪 Shop Owner Dashboard**

View:

✔ Retail stock  
✔ Sales outflow  
✔ Conversion history (read-only)

Actions:

✔ Report damage  
✔ Request adjustment

### **🏪 Shop Owner Dashboard**

# **FINAL POLISHED INVENTORY ARCHITECTURE**

✅ (এই অংশটা সরাসরি ডেভেলপারকে পাঠাতে পারবেন)

---

# **📦 Inventory Architecture – Single Source of Truth (Final)**

---

## **🔄 Stock Flow Chain**

Super Seller Inventory  
      ↓ (B2B Sale)  
Shop Trade Inventory  
      ↓ (Auto Conversion)  
Shop Retail Inventory  
      ↓ (B2C Sale)  
Consumer

✔ প্রতিটি স্টকের আলাদা Owner থাকবে  
 ✔ কোনো স্টক ডুপ্লিকেট হবে না  
 ✔ সব স্টক মুভমেন্ট ledger দ্বারা ট্র্যাক হবে  
 ✔ Inventory snapshot শুধুমাত্র বর্তমান ব্যালেন্স দেখাবে

---

## **🎯 Inventory Ownership**

| Owner Type | Purpose |
| ----- | ----- |
| Super Seller | B2B Sell |
| Shop Owner | B2C Sell |
| System (Virtual) | Conversion Buffer |

---

---

## **🗃️ Database Structure**

### **📦 inventories (Live Snapshot)**

inventories  
\------------  
id  
owner\_type           (super\_seller / shop)  
owner\_id  
variant\_id  
available\_qty  
reserved\_qty  
updated\_at

🚫 damaged\_qty রাখা হবে না  
 👉 Damage সরাসরি available\_qty থেকে কমবে

Safety Rules:

available\_qty \>= 0  
reserved\_qty \>= 0

---

---

### **📜 stock\_ledger (Immutable Audit Log)**

stock\_ledger  
\-------------  
id  
variant\_id  
owner\_type  
owner\_id

change\_type  
  (IN / OUT / CONVERT\_IN / CONVERT\_OUT / DAMAGE / RETURN / ADJUST)

qty  
reason

reference\_type (order / return / damage / manual)  
reference\_id

balance\_after  
created\_at

✔ প্রতিটি স্টক পরিবর্তনে ledger বাধ্যতামূলক  
 ✔ Ledger কখনো edit বা delete করা যাবে না

---

---

### **🔁 variant\_conversion\_map**

variant\_conversion\_map  
\-----------------------  
from\_variant\_id  
to\_variant\_id  
conversion\_ratio  
auto\_convert (true/false)

---

---

## **🔄 Stock Flow Scenarios**

---

### **🟦 Scenario–1: Super Seller → Shop (B2B Order)**

Shop orders: 2 Carton

Super Seller Inventory:  
\-2 Carton (OUT)

Shop Trade Inventory:  
\+2 Carton (IN)

Auto Conversion (atomic):  
\+20 Retail Pack (CONVERT\_IN)  
\-2 Carton Trade (CONVERT\_OUT)

✔ Retail stock becomes sellable

---

---

### **🟢 Scenario–2: Shop → Consumer (B2C Sale)**

Consumer buys: 3 Pack

Shop Retail Inventory:  
\-3 Pack (OUT)  
Ledger entry created

---

---

### **🔁 Scenario–3: Loose Conversion**

Shop buys: 1 Sack (50kg)

Auto Convert:  
\+50 KG Loose Retail (CONVERT\_IN)  
\-1 Sack Trade (CONVERT\_OUT)

---

---

### **♻️ Scenario–4: Return**

If APPROVED \+ RECEIVED:

If resellable:  
    \+Returned Qty (RETURN)

If damaged:  
    No stock added  
    DAMAGE ledger entry

---

---

### **⚠️ Scenario–5: Damage Reporting**

Shop reports damage: 2 Pack

available\_qty \= available\_qty \- 2

Ledger:  
change\_type \= DAMAGE  
reason \= user input

---

---

## **🔐 Stock Locking & Safety Rules**

### **Reservation Logic**

Order Placed:  
available\_qty ↓  
reserved\_qty ↑

Order Confirmed:  
reserved\_qty ↓ (OUT)

Order Cancelled / Expired:  
reserved\_qty → available\_qty

---

### **🔒 OTP Safety Lock**

If seller has \>= 2 pending OTP orders:  
    Do NOT reserve inventory for new Open Orders

---

---

## **🔒 Transaction Safety Rules**

✔ available\_qty cannot go below 0  
✔ reserved\_qty cannot go below 0  
✔ Conversion must be atomic (IN \+ OUT together)  
✔ Return stock added only after APPROVED \+ RECEIVED

---

---

## **🧑‍💼 Stock Permission Model**

### **✅ Shop Owner Can**

✔ View stock  
 ✔ Report damage  
 ✔ Reduce stock with reason  
 ✔ View ledger (read-only)

### **❌ Shop Owner Cannot**

❌ Add new product  
 ❌ Edit ledger  
 ❌ Inflate stock

---

### **🧑‍💼 Admin Can**

✔ Manual correction  
 ✔ Stock import  
 ✔ Adjustment approval  
 ✔ Full audit access

---

---

## **🏷️ External Stock Handling (Optional – Tag Only)**

external\_stock\_flag \= true

✔ Display only  
 ✔ Excluded from inventory calculation  
 ✔ Cannot sell unless Admin approves mapping

👉 Prevents fake stock inflation.

---

---

## **🖥️ UI Behavior**

### **🧑‍💼 Super Seller Dashboard**

View:  
 ✔ Stock by variant  
 ✔ Low stock alerts  
 ✔ Ledger history

Actions:  
 ✔ Import stock  
 ✔ Manual adjustment  
 ✔ Audit logs

---

### **🏪 Shop Owner Dashboard**

View:  
 ✔ Retail stock  
 ✔ Sales outflow  
 ✔ Conversion history (read-only)

Actions:  
 ✔ Report damage  
 ✔ Request adjustment

# Return System

# **🔁 Unified Return System Architecture**

---

**🧱 1\. Core Return Entities (Database Level)**  
---

 **🚫 Cancel Rule (Before Pickup)**

If delivery\_status \!= PICKED:

    User can CANCEL order

    No return flow triggered

    Reserved stock released

👉 এই স্টেজে Return হবে না — শুধু Cancel।

---

### **♻️ Return Rule (After Pickup)**

If delivery\_status \== PICKED or later:

    Return flow allowed

✔ Consumer return initiate করতে পারবে  
 ✔ Shop Owner return initiate করতে পারবে  
 ✔ Deliveryman শুধু pickup/confirmation করবে

---

---

# **🧱 1\. Core Return Entities (Database Level)**

### **📦 returns**

returns

\--------

id

return\_number

order\_id

initiated\_by\_id

initiated\_by\_role (consumer / shop\_owner)

buyer\_id

seller\_id

return\_type (B2B / B2C)

status

reason\_code

description

refund\_amount

refund\_method (wallet / original / credit\_note / replacement)

requested\_at

approved\_at

completed\_at

---

---

### **🧺 return\_items**

return\_items

\--------------

id

return\_id

order\_item\_id

variant\_id

return\_qty

condition (sealed / opened / damaged / expired)

inspection\_required (true/false)

---

---

### **📸 return\_attachments**

return\_attachments

\-------------------

id

return\_id

file\_url

file\_type (image / video)

uploaded\_by

---

---

### **🔔 return\_events (Audit Timeline)**

return\_events

\--------------

id

return\_id

event\_type

actor\_id

notes

created\_at

---

---

# **⚙️ 2\. Return Status Flow (Unified)**

### **📌 Universal Return Status**

REQUESTED

AUTO\_APPROVED (optional)

PENDING\_INSPECTION

PICKUP\_ASSIGNED

IN\_TRANSIT

RECEIVED

APPROVED

REJECTED

REFUNDED / CREDIT\_ISSUED / REPLACED

CLOSED

---

---

## **🟦 B2B Return Flow (Shop Owner → Super Seller)**

REQUESTED

   ↓

PENDING\_INSPECTION

   ↓

APPROVED / REJECTED

   ↓

CREDIT\_NOTE / REPLACEMENT

   ↓

CLOSED

### **Rules**

✔ Only sealed / transit damaged accepted  
 ✔ Loose bulk return only with proof  
 ✔ Credit note preferred  
 ✔ Strict return window

---

---

## **🟢 B2C Return Flow (Consumer / Shop Owner → Shop Owner)**

REQUESTED

   ↓

PICKUP\_ASSIGNED

   ↓

RECEIVED

   ↓

APPROVED / REJECTED

   ↓

REFUNDED / REPLACED

   ↓

CLOSED

### **Rules**

✔ Defective / wrong / damaged accepted  
 ✔ Loose product stricter validation  
 ✔ Wallet refund preferred  
 ✔ Time bound

---

---

# **🔐 3\. Inventory Adjustment Integration (UPDATED)**

### **🚫 When Return Requested**

No stock change

---

### **✅ When Return Approved & Received**

#### **✔ If resellable:**

available\_qty \+= return\_qty

Ledger: RETURN\_IN

---

#### **❌ If damaged / expired:**

available\_qty \-= return\_qty

Ledger: DAMAGE

(No damaged bucket)

---

---

# **🚚 4\. Delivery Confirmation Integration**

### **Deliveryman App Flow**

Did customer return product?

\[ YES \] \[ NO \]

If YES:

   Capture photo (optional)

   Confirm receipt

If NO:

   Mark as failed pickup

   Notify admin / shop

---

---

# **🖥️ 5\. UI Behavior**

---

### **🧑 Consumer**

✔ Can cancel before pickup

✔ Can request return after pickup

✔ Can upload photos

✔ Can track return status

---

---

### **🏪 Shop Owner**

✔ Can initiate return (B2C / B2B)

✔ Can approve small returns (policy based)

✔ View return ledger

✔ Cannot edit stock manually

---

---

### **🧑‍💼 Admin (Super Seller)**

✔ Full return approval

✔ Credit note issue

✔ Damage audit

✔ Ledger export

✔ Override decisions

---

Actors:

1. 🧑 Consumer

2. 🏪 Shop Owner (Customer / Seller)

3. 🧑‍💼 Super Seller (Admin)

4. 🚚 Delivery / System

---

# **♻️ RETURN MODULE — STEP BY STEP OPERATION FLOW**

---

# **🧑 1️⃣ Consumer → Return Flow (B2C)**

### **🎯 Scenario**

Consumer তার কেনা প্রোডাক্ট রিটার্ন করতে চায়।

---

### **✅ Step Flow**

Step 1:

Consumer → My Orders → Select Order → Click "Request Return"

Step 2:

Select Return Reason

✔ Damaged

✔ Wrong Item

✔ Expired

✔ Quality Issue

Upload Photo (optional)

Submit Request

---

Step 3:

System creates Return Record

status \= REQUESTED

Shop Owner gets notification

---

Step 4:

Shop Owner reviews request

Option:

✔ Approve

✔ Reject

---

Step 5 (If Approved):

Pickup assigned

Delivery collects item

status \= IN\_TRANSIT

---

Step 6:

Shop receives returned item

Confirms condition

If resellable:

    Inventory increases

Else:

    Damage deducted

status \= APPROVED

---

Step 7:

Refund processed

Wallet / Cash / Replacement

status \= CLOSED

---

---

# **🏪 2️⃣ Shop Owner → Return Flow (B2B)**

### **🎯 Scenario**

Shop Owner Dealer থেকে কেনা পণ্য রিটার্ন করতে চায়।

---

### **✅ Step Flow**

Step 1:

Shop Owner → B2B Orders → Select Order → Request Return

Select reason

Upload proof (mandatory)

Submit

---

Step 2:

System creates return

status \= REQUESTED

Super Seller notified

---

Step 3:

Super Seller reviews request

Option:

✔ Approve Inspection

✔ Reject

---

Step 4:

If Inspection Required:

Pickup scheduled

Item returned to Super Seller warehouse

---

Step 5:

Super Seller inspects

If accepted:

    Credit note issued

    Inventory adjusted

Else:

    Return rejected

---

Step 6:

status \= CLOSED

---

---

# **🧑‍💼 3️⃣ Super Seller → How They Handle Returns**

### **🎯 Responsibilities**

✔ View all returns

✔ Filter by status

✔ Review evidence

✔ Approve / Reject

✔ Adjust inventory

✔ Issue credit

✔ Audit logs

---

### **🖥️ Admin UI Steps**

Dashboard → Returns Panel

→ View Pending Returns

→ Open Return Details

→ Review photos

→ Approve / Reject

→ Confirm inventory action

---

---

# **🚚 4️⃣ Delivery / System Role**

### **🎯 System Automation**

✔ Assign pickup

✔ Track transit

✔ Update statuses

✔ Notify users

✔ Auto timeout handling

✔ Ledger updates

---

---

# **🧩 Summary Table**

| Actor | Sends Return | Receives Return | Approves | Inventory Update |
| ----- | ----- | ----- | ----- | ----- |
| Consumer | ✅ | ❌ | ❌ | ❌ |
| Shop Owner | ✅ (B2B) | ✅ (B2C) | ✅ | ✅ |
| Super Seller | ❌ | ✅ (B2B) | ✅ | ✅ |
| System | ❌ | ❌ | ❌ | ✅ |

---

# **EMPTY PACK RETURN CONFIGURATION SYSTEM**

(Production Ready Specification)

---

# **🎯 Core Objective**

✔ প্রতিটি প্রোডাক্টে নির্ধারণ করা যাবে:

Empty Pack Returnable? → YES / NO

✔ Returnable হলে:

Empty Pack Value (Deposit Price)

✔ Super Seller এবং Seller উভয়েই কনফিগার করতে পারবে  
 ✔ Consumer পণ্যের বিবরণে স্পষ্টভাবে দেখতে পাবে  
 ✔ Pack না থাকলে অর্ডারে অতিরিক্ত চার্জ যুক্ত হবে

---

---

# **🧱 1️⃣ Product Configuration Model**

### **📦 product\_pack\_rules**

product\_pack\_rules

\-------------------

id

product\_id

owner\_type (super\_seller / shop)

owner\_id

is\_empty\_pack\_returnable (true/false)

empty\_pack\_value

status

updated\_at

---

---

# **🧠 Rule Priority Logic**

If shop has custom rule:

    Use shop rule

Else:

    Use super seller default rule

---

---

# **🖥️ 2️⃣ Seller / Super Seller UI Flow**

---

### **🏪 Seller Product Edit Screen**

\[ \] Empty Pack Returnable?  (Yes / No toggle)

If YES:

    Enter Empty Pack Value (৳)

---

---

### **🧑‍💼 Super Seller Product Edit Screen**

\[ \] Empty Pack Returnable?  (Yes / No toggle)

If YES:

    Enter Default Empty Pack Value (৳)

---

---

# **👤 3️⃣ Consumer Product View**

### **🛒 Product Details Page**

Display:

♻ Empty Pack Return: YES

Deposit Amount: ৳120

---

---

### **🛍️ Order Placement UI**

Do you have empty pack?

\[ YES \] \[ NO \]

If YES:

    Select Brand

    Select Size

If NO:

    Empty Pack Charge ৳120 added

---

---

# **💰 4️⃣ Billing Logic**

If has\_empty\_pack \== false AND is\_returnable\_pack \== true:

    order\_total \+= empty\_pack\_value

---

---

# **🚚 5️⃣ Delivery Confirmation**

Delivery App:

Did customer return empty pack?

\[ YES \] \[ NO \]

If NO:

    Charge confirmed

If YES:

    No charge

---

---

# **🔐 6️⃣ Audit & Control**

✔ All changes logged

✔ Admin override allowed

✔ Fraud detection enabled

---

**3️⃣ FINAL POLISHED VERSION**

✅ (আপডেটসহ ক্লিন কপি – ডেভেলপারকে পাঠাতে পারবেন)

---

# **🔁 Unified Return System Architecture (Final)**

---

## **🚫 Cancel Rule (Before Pickup)**

If delivery\_status \!= PICKED:

    User can CANCEL order

    No return flow triggered

    Reserved stock released

👉 এই স্টেজে Return হবে না — শুধু Cancel।

---

## **♻️ Return Rule (After Pickup)**

If delivery\_status \== PICKED or later:

    Return flow allowed

✔ Consumer return initiate করতে পারবে  
 ✔ Shop Owner return initiate করতে পারবে  
 ✔ Deliveryman শুধু pickup / confirmation করবে

---

---

## **🧱 1\. Core Return Entities (Database Level)**

### **📦 returns**

returns

\--------

id

return\_number

order\_id

initiated\_by\_id

initiated\_by\_role (consumer / shop\_owner)

buyer\_id

seller\_id

return\_type (B2B / B2C)

status

reason\_code

description

refund\_amount

refund\_method (wallet / original / credit\_note / replacement)

return\_deadline\_at

is\_suspected\_fraud (true/false)

requested\_at

approved\_at

completed\_at

---

### **🧺 return\_items**

return\_items

\--------------

id

return\_id

order\_item\_id

variant\_id

return\_qty

condition (sealed / opened / damaged / expired)

inspection\_required (true/false)

Rule:

Total return\_qty \<= original order qty

---

### **📸 return\_attachments**

return\_attachments

\-------------------

id

return\_id

file\_url

file\_type (image / video)

uploaded\_by

---

### **🔔 return\_events**

return\_events

\--------------

id

return\_id

event\_type

actor\_id

notes

created\_at

---

---

## **⚙️ 2\. Return Status Flow**

REQUESTED

AUTO\_APPROVED (optional)

PENDING\_INSPECTION

PICKUP\_ASSIGNED

IN\_TRANSIT

RECEIVED

APPROVED

REJECTED

REFUNDED / CREDIT\_ISSUED / REPLACED

CLOSED

---

### **🟦 B2B Return Flow**

REQUESTED

 → PENDING\_INSPECTION

 → APPROVED / REJECTED

 → CREDIT\_NOTE / REPLACEMENT

 → CLOSED

Rules:  
 ✔ Sealed / transit damage only  
 ✔ Loose bulk needs proof  
 ✔ Credit note preferred  
 ✔ Strict return window

---

### **🟢 B2C Return Flow**

REQUESTED

 → PICKUP\_ASSIGNED

 → RECEIVED

 → APPROVED / REJECTED

 → REFUNDED / REPLACED

 → CLOSED

Rules:  
 ✔ Defective / wrong / damaged  
 ✔ Loose stricter  
 ✔ Wallet refund preferred  
 ✔ Time bound

---

---

## **🔐 3\. Inventory Adjustment Integration**

### **🚫 When Return Requested**

No stock change

---

### **✅ When Approved \+ Received**

**If resellable**

available\_qty \+= return\_qty

Ledger: RETURN\_IN

**If damaged / expired**

available\_qty \-= return\_qty

Ledger: DAMAGE

Safety:

available\_qty cannot go below 0

---

---

## **🚚 4\. Delivery Confirmation**

Delivery App:

Did customer return product?

\[ YES \] \[ NO \]

If YES:  
 ✔ Capture photo  
 ✔ Confirm receipt

If NO:  
 ✔ Mark failed pickup  
 ✔ Notify admin/shop

---

---

## **🖥️ 5\. UI Behavior**

### **🧑 Consumer**

✔ Cancel before pickup  
 ✔ Request return after pickup  
 ✔ Upload photos  
 ✔ Track status

---

### **🏪 Shop Owner**

✔ Initiate return (B2B/B2C)  
 ✔ Approve small returns  
 ✔ View ledger  
 ❌ Cannot manually edit stock

---

### **🧑‍💼 Super Seller**

✔ Full approval  
 ✔ Credit note  
 ✔ Damage audit  
 ✔ Ledger export  
 ✔ Override

---

---

## **♻️ EMPTY PACK RETURN CONFIGURATION SYSTEM**

---

### **🎯 Objective**

✔ Product level empty pack rule  
 ✔ Deposit charge if no pack  
 ✔ Seller override allowed  
 ✔ Consumer visible

---

### **🧱 product\_pack\_rules**

product\_pack\_rules

\-------------------

id

product\_id

owner\_type (super\_seller / shop)

owner\_id

is\_empty\_pack\_returnable

empty\_pack\_value

status

updated\_at

---

### **🧠 Rule Priority**

If shop rule exists:

    Use shop rule

Else:

    Use super seller rule

---

---

### **🛍️ Consumer Order Flow**

Do you have empty pack?

\[ YES \] \[ NO \]

If YES:

    Select brand

    Select size

If NO:

    Deposit added

---

---

### **💰 Billing Logic**

If no pack AND returnable:

    order\_total \+= empty\_pack\_value

---

---

### **🚚 Delivery Confirmation**

Did customer return empty pack?

\[ YES \] \[ NO \]

If YES → No charge  
 If NO → Deposit confirmed

---

---

### **🔐 Audit Rules**

✔ All changes logged  
 ✔ Admin override allowed  
 ✔ Fraud monitoring enabled

# Product Access Model

**Shop Owner Product Control System Architecture**

(Admin Controlled Multi-Layer Access Model)

---

# **🎯 Core Business Rules**

✔ সব Shop Owner seller হবে না  
 ✔ Admin নির্ধারণ করবে কে কোন প্রোডাক্ট বিক্রি করতে পারবে  
 ✔ Shop Owner নিজে কোনো প্রোডাক্ট যোগ করতে পারবে না  
 ✔ Dealer থেকে অর্ডার করলে প্রোডাক্ট অটো স্টোরে আসবে  
 ✔ Consumer শুধুমাত্র অনুমোদিত প্রোডাক্ট দেখবে  
 ✔ Open Order শুধু eligible seller পাবে  
 ✔ Area permission বাধ্যতামূলক

---

---

# **🧱 1️⃣ Seller Eligibility Layer**

shop\_seller\_profiles  
\----------------------  
shop\_id  
seller\_status (enabled / disabled)  
allowed\_categories  
allowed\_variants  
area\_permission\_ids  
restricted\_business\_type (restaurant / reseller / etc)

Rules:

If seller\_status \!= enabled → cannot sell  
If product.category not in allowed\_categories → cannot sell  
If area not permitted → cannot accept open order

---

---

# **🧱 2️⃣ Business Model Structure (Admin Side)**

### **📦 sales\_models**

id  
model\_name  
description  
status  
created\_at

---

### **📦 model\_products**

id  
model\_id  
product\_id  
variant\_ids  
status

---

### **📦 shop\_model\_assignments**

id  
shop\_id  
model\_id  
assigned\_at  
status

---

---

# **🏪 3️⃣ Shop Owner Product Access Rules**

### **✅ Shop Owner Can**

✔ View assigned model products  
✔ Buy B2B products  
✔ Sell approved products  
✔ Set consumer price  
✔ Update daily price

---

### **❌ Shop Owner Cannot**

❌ Add new product manually  
❌ Sell outside assigned model  
❌ Override restricted category  
❌ Sell external products

---

---

# **💰 4️⃣ Dual Pricing System (Platform vs Shop)**

product\_base\_prices  
\---------------------  
product\_id  
variant\_id  
base\_price  
min\_price  
max\_price  
updated\_by\_admin

shop\_prices  
\--------------  
shop\_id  
variant\_id  
selling\_price  
last\_updated\_at

Rules:

shop\_price must be between min\_price and max\_price  
Admin can override anytime

---

---

# **🛒 5️⃣ Product Auto Assignment Flow (Updated)**

Shop places B2B order  
    ↓  
Validate:  
✔ Shop eligible seller  
✔ Product in assigned model  
✔ Category allowed  
    ↓  
Order confirmed  
    ↓  
Inventory received  
    ↓  
Product auto-added to shop catalog  
    ↓  
Shop must set price before selling  
    ↓  
Consumer can view product

---

---

# **👁️ 6️⃣ Consumer Product Visibility Logic**

Consumer sees only:

✔ Product approved by Admin  
✔ Product in shop's model  
✔ Shop seller enabled  
✔ Stock available  
✔ Price set today  
✔ Area permitted

---

---

# **🤖 7️⃣ Open Order Eligibility Logic**

Shop can receive open order only if:

✔ seller\_status \== enabled  
✔ product allowed  
✔ stock available  
✔ area permitted  
✔ OTP pending count \< 2

---

---

# **🛡️ 8️⃣ Admin Control Panel Capabilities**

Admin can:

✔ Enable / disable seller  
✔ Assign / change model  
✔ Control allowed categories  
✔ Control price rules  
✔ Audit selling behavior  
✔ Suspend violation

---

# Damage Stock Adjustment

**Simple Damage Stock Adjustment Model**

(Production Ready Specification)

---

# **🎯 Core Business Rule**

Damaged Quantity \= Directly subtract from available\_qty  
No separate damaged inventory bucket  
All damage must be recorded in stock\_ledger

👉 Inventory টেবিলে শুধুমাত্র **একটাই লাইভ স্টক থাকবে:**

available\_qty

---

---

# **🗃️ Inventory Structure (Simplified)**

### **📦 inventories**

inventories  
\------------  
id  
owner\_type (super\_seller / shop)  
owner\_id  
variant\_id  
available\_qty  
reserved\_qty  
updated\_at

🚫 damaged\_qty কলাম নেই  
 🚫 Damage আলাদা করে কোথাও জমা হবে না

---

---

### **📜 stock\_ledger (Damage Tracking)**

stock\_ledger  
\-------------  
id  
variant\_id  
owner\_type  
owner\_id  
change\_type \= DAMAGE  
qty  
reason  
reference\_type \= damage  
reference\_id  
balance\_after  
created\_at

✔ Damage হলেই ledger entry বাধ্যতামূলক  
 ✔ Ledger কখনো edit / delete করা যাবে না

---

---

# **⚙️ Damage Adjustment Logic**

### **🧮 When Damage Reported**

IF available\_qty \>= damage\_qty:  
    available\_qty \= available\_qty \- damage\_qty  
    Create stock\_ledger entry (DAMAGE)  
ELSE:  
    Reject (Insufficient stock)

---

---

# **📌 Damage Classification**

| Case | Treatment |
| ----- | ----- |
| Broken / Torn Pack | Treated as Loss |
| Wet / Contaminated | Treated as Loss |
| Expired | Treated as Loss |
| Mishandled | Treated as Loss |

👉 কোন Recovery / Repair Tracking থাকবে না।  
 👉 প্রয়োজনে Admin manual adjustment করতে পারবে।

---

---

# **🔐 Permission Rules**

---

## **🏪 Shop Owner**

### **✅ Can**

✔ Report damage  
✔ Enter qty \+ reason  
✔ View own damage history (read-only)

### **❌ Cannot**

❌ Increase stock  
❌ Edit ledger  
❌ Reverse damage

---

---

## **🧑‍💼 Admin (Super Seller)**

### **✅ Can**

✔ View all damage logs  
✔ Export damage reports  
✔ Perform manual correction (with audit)  
✔ Investigate abuse

---

---

# **🖥️ UI Behavior**

---

## **🏪 Shop Owner UI**

Button:

\[ Report Damage \]

Popup Form:

• Product / Variant (auto selected)  
• Damage Quantity  
• Reason (dropdown \+ text)  
• Submit

System Action:

✔ available\_qty auto reduced  
✔ Ledger entry created  
✔ Confirmation toast

---

---

## **🧑‍💼 Admin UI**

Dashboard:

✔ Damage log table  
✔ Filter by shop / product / date  
✔ Export CSV / PDF  
✔ Manual correction action

---

---

# **🛡️ Safety Rules**

✔ Cannot report damage if stock \< qty  
✔ Cannot modify ledger  
✔ All actions audited  
✔ Admin override logged

# **FINAL POLISHED VERSION (আপডেট সহ)**

আপনি চাইলে এই ভার্সনটা সরাসরি ডেভেলপারকে দিতে পারেন:

---

# **🧱 Simple Damage Stock Adjustment Model**

(Production Ready Specification)

---

## **🎯 Core Business Rule**

Damaged Quantity \= Directly subtract from available\_qty  
No separate damaged inventory bucket  
All damage must be recorded in stock\_ledger

👉 Inventory টেবিলে শুধুমাত্র একটাই লাইভ স্টক থাকবে:

available\_qty

---

## **🗃️ Inventory Structure**

### **📦 inventories**

id  
owner\_type (super\_seller / shop)  
owner\_id  
variant\_id  
available\_qty  
reserved\_qty  
updated\_at

🚫 damaged\_qty নেই  
 🚫 Damage আলাদা কোথাও জমা হবে না

---

### **📜 stock\_ledger (Damage Tracking)**

id  
variant\_id  
owner\_type  
owner\_id  
change\_type \= DAMAGE

qty  
reason\_code (BROKEN / WET / EXPIRED / MISHANDLED / OTHER)  
reason\_note

reference\_type \= damage\_report  
reference\_id

balance\_after  
created\_at

✔ Ledger immutable  
 ✔ Every damage must write ledger

---

---

## **⚙️ Damage Adjustment Logic**

IF available\_qty \>= damage\_qty:  
    available\_qty \= available\_qty \- damage\_qty  
    Create stock\_ledger entry (DAMAGE)  
ELSE:  
    Reject (Insufficient stock)

⚠️ Update must run inside DB transaction lock.

---

---

## **📌 Damage Classification**

| Case | Treatment |
| ----- | ----- |
| Broken / Torn Pack | Loss |
| Wet / Contaminated | Loss |
| Expired | Loss |
| Mishandled | Loss |

👉 No recovery tracking  
 👉 Admin can manually adjust if required

---

---

## **🔐 Permission Rules**

### **🏪 Shop Owner**

✅ Can

* Report damage

* Enter qty \+ reason

* View own damage history (read-only)

❌ Cannot

* Increase stock

* Edit ledger

* Reverse damage

---

### **🧑‍💼 Admin**

✅ Can

* View all damage logs

* Export reports

* Manual correction (audited)

* Investigate abuse

---

---

## **🖥️ UI Behavior**

### **🏪 Shop Owner**

Button:

\[ Report Damage \]

Popup:

* Variant (auto selected)

* Damage Quantity

* Reason (dropdown \+ note)

* Submit

System:  
 ✔ Stock auto reduced  
 ✔ Ledger entry created  
 ✔ Confirmation shown

---

### **🧑‍💼 Admin**

Dashboard:

* Damage log table

* Filters

* Export CSV / PDF

* Manual correction

---

---

## **🛡️ Safety Rules**

✔ Cannot report damage if stock \< qty  
 ✔ Ledger immutable  
 ✔ All actions audited  
 ✔ Admin override logged  
 ✔ Daily abnormal damage can be flagged

# Products Pack Information

# **Product Pack Information & Empty Pack Return System**

(Production Ready Specification)

---

**🎯 Core Business Objective**

✔ কিছু নির্দিষ্ট প্রোডাক্টে Empty Pack ফেরত নেওয়া হবে  
 ✔ কনজুমার অর্ডার করার সময় জানাবে:

* আগের প্যাকেট কোন ব্র্যান্ডের

* সে কোন ব্র্যান্ড নিতে চায়

* কোন সাইজের প্যাকেট নিতে চায়

✔ আগের প্যাকেট না থাকলে → অতিরিক্ত Pack Deposit চার্জ যুক্ত হবে  
 ✔ এই রুল সব প্রোডাক্টে প্রযোজ্য হবে না — শুধুমাত্র কনফিগার্ড প্রোডাক্টে

---

**🧱 1️⃣ Product Level Configuration**

### **📦 products table (Extended Fields)**

products

\----------

id

name

category\_id

is\_returnable\_pack (true / false)

pack\_deposit\_amount

allowed\_pack\_brands (json array)

allowed\_pack\_sizes (json array)

status

---

---

# **🧠 Business Rules**

If is\_returnable\_pack \= false:

    Pack section hidden

    No deposit applied

If is\_returnable\_pack \= true:

    Pack selection mandatory

---

---

# **🛒 2️⃣ Order UI Selection Flow (Consumer Side)**

---

### **🖥️ UI Logic**

When consumer opens product page:

IF product.is\_returnable\_pack \== true:

    Show Pack Information Section

ELSE:

    Hide Pack Section

---

---

### **♻️ Pack Information Section**

Do you have an old pack?

\[ YES \] \[ NO \]

---

#### **✅ If YES**

Previous Pack Brand  (Dropdown from allowed\_pack\_brands)

Previous Pack Size   (Dropdown from allowed\_pack\_sizes)

New Pack Brand        (Dropdown from allowed\_pack\_brands)

New Pack Size         (Dropdown from allowed\_pack\_sizes)

---

---

#### **❌ If NO**

Show Notice:

"A pack deposit of ৳XXX will be added."

Auto add deposit to order summary

---

---

### **🧾 Order Payload Example**

pack\_info:

{

   has\_old\_pack: true,

   old\_brand: "Pran",

   old\_size: "5KG",

   new\_brand: "IFAD",

   new\_size: "5KG",

   deposit\_applied: false

}

OR

pack\_info:

{

   has\_old\_pack: false,

   deposit\_applied: true,

   deposit\_amount: 120

}

---

---

# **💰 3️⃣ Pricing & Billing Integration**

### **💳 Order Calculation**

order\_total \=

    product\_total

  \+ delivery\_charge

  \+ (pack\_deposit\_amount if has\_old\_pack \== false)

---

---

### **🧾 Invoice Display**

Invoice shows:

✔ Product Amount

✔ Delivery Charge

✔ Pack Deposit (if applied)

---

---

# **🚚 4️⃣ Delivery Confirmation Flow**

---

### **📱 Deliveryman App**

Did customer return old pack?

\[ YES \] \[ NO \]

---

#### **✅ If YES**

✔ Capture photo (optional)

✔ Confirm

✔ No extra charge

---

---

#### **❌ If NO**

✔ System confirms deposit charge

✔ Ledger entry created

✔ Customer notified

---

---

# **🔐 5️⃣ Fraud & Validation Rules**

✔ Deliveryman confirmation required

✔ Photo optional but logged

✔ Dispute can be raised within 24h

✔ Admin override allowed

---

---

# **🖥️ 6️⃣ Admin Control Panel**

Admin can:

✔ Enable / disable pack return per product

✔ Set deposit amount

✔ Configure allowed brands & sizes

✔ View pack return statistics

✔ Audit disputes

---

---

# **🏪 7️⃣ Shop Owner Visibility**

Shop Owner can:

✔ View pack return status per order

✔ See deposit collected

✔ Cannot change pack configuration

# **FINAL POLISHED VERSION (Updated – Developer Ready)**

আপনি নিচের ভার্সনটি সরাসরি ডেভেলপারকে দিতে পারবেন ✅

---

# **📦 Product Pack Information & Empty Pack Return System**

(Production Ready Specification)

---

## **🎯 Core Business Objective**

✔ কিছু নির্দিষ্ট প্রোডাক্টে Empty Pack ফেরত নেওয়া হবে  
 ✔ কনজুমার অর্ডার করার সময় জানাবে:

* আগের প্যাকেট কোন ব্র্যান্ডের

* সে কোন ব্র্যান্ড নিতে চায়

* কোন সাইজের প্যাকেট নিতে চায়

✔ আগের প্যাকেট না থাকলে → অতিরিক্ত Pack Deposit চার্জ যুক্ত হবে  
 ✔ এই রুল সব প্রোডাক্টে প্রযোজ্য নয় — শুধুমাত্র কনফিগার্ড প্রোডাক্টে

---

---

## **🧱 1️⃣ Product Level Configuration**

### **📦 products (Extended Fields)**

products

\----------

id

name

category\_id

is\_returnable\_pack (true / false)

pack\_deposit\_amount

allowed\_pack\_brands (json array)

allowed\_pack\_sizes (json array)

status

---

### **🧠 Business Rules**

If is\_returnable\_pack \== false:

    Hide pack section

    No deposit applied

If is\_returnable\_pack \== true:

    Pack selection mandatory

---

---

## **🏪 Rule Ownership & Priority**

Super Seller:

    Can define default pack rules

Shop Owner:

    Can override pack rules for their shop (optional)

Priority Logic:

    If shop rule exists → use shop rule

    Else → use super seller rule

---

---

## **🛒 2️⃣ Order UI Selection Flow (Consumer Side)**

### **UI Logic**

If product.is\_returnable\_pack \== true:

    Show Pack Information Section

Else:

    Hide Pack Section

---

### **♻️ Pack Information Section**

Do you have an old pack?

\[ YES \] \[ NO \]

---

### **✅ If YES**

Previous Pack Brand  (Dropdown)

Previous Pack Size   (Dropdown)

New Pack Brand        (Dropdown)

New Pack Size         (Dropdown)

---

### **❌ If NO**

Show notice:

"A pack deposit of ৳XXX will be added."

Deposit auto added to order summary

---

---

## **🧾 Order Payload Example**

### **Case — Has old pack**

pack\_info \= {

   has\_old\_pack: true,

   old\_brand: "Pran",

   old\_size: "5KG",

   new\_brand: "IFAD",

   new\_size: "5KG",

   deposit\_applied: false

}

---

### **Case — No old pack**

pack\_info \= {

   has\_old\_pack: false,

   deposit\_applied: true,

   deposit\_amount: 120

}

---

---

## **💰 3️⃣ Pricing & Billing Integration**

### **Order Total Calculation**

order\_total \=

    product\_total

  \+ delivery\_charge

  \+ (pack\_deposit\_amount if has\_old\_pack \== false)

---

### **Invoice Display**

✔ Product Amount  
 ✔ Delivery Charge  
 ✔ Pack Deposit (if applied)

---

---

## **🚚 4️⃣ Delivery Confirmation Flow**

### **Delivery App**

Did customer return old pack?

\[ YES \] \[ NO \]

---

### **✅ If YES**

✔ Capture photo (optional)  
 ✔ Confirm  
 ✔ Deposit eligible for refund

---

### **❌ If NO**

✔ Deposit confirmed  
 ✔ Ledger entry created  
 ✔ Customer notified

---

---

## **💵 5️⃣ Deposit Refund Logic**

If empty\_pack\_returned \== true:

    Refund pack\_deposit\_amount

    Ledger: PACK\_DEPOSIT\_REFUNDED

Else:

    Deposit retained

    Ledger: PACK\_DEPOSIT\_COLLECTED

---

---

## **🔐 6️⃣ Fraud & Validation Rules**

✔ Delivery confirmation mandatory  
 ✔ Photo stored if uploaded  
 ✔ Dispute allowed within 24h  
 ✔ Admin override supported  
 ✔ All actions logged

---

---

## **🖥️ 7️⃣ Admin Control Panel**

Admin can:  
 ✔ Enable / disable pack return per product  
 ✔ Set deposit amount  
 ✔ Configure allowed brands & sizes  
 ✔ View pack return analytics  
 ✔ Resolve disputes  
 ✔ Override rules

---

---

## **🏪 8️⃣ Shop Owner Visibility**

Shop Owner can:  
 ✔ View pack return status per order  
 ✔ See deposit collected / refunded  
 ✔ Override pack rule if permitted  
 ❌ Cannot edit system ledger

# Order System

# **Unified Order System Architecture (v2)**

(Production Ready Specification)

---

# **🧱 1️⃣ Core Order Entities (Updated)**

### **📦 orders**

orders  
\-------  
id  
order\_number

order\_type (B2B / B2C / OPEN)

buyer\_id  
buyer\_role (shop\_owner / consumer)

seller\_id (dealer / shop\_owner / null)

consumer\_area\_id  
matched\_area\_id

status  
subtotal  
delivery\_charge  
grand\_total

base\_price\_snapshot  
vendor\_price\_snapshot  
price\_delta

payment\_status  
delivery\_status

otp\_code  
otp\_expires\_at  
otp\_verified\_at  
pending\_otp\_flag (true/false)

negotiation\_deadline\_at  
negotiation\_status (pending / submitted / accepted / expired)

location\_lat  
location\_lng

expires\_at  
locked\_at  
open\_broadcasted\_at  
accepted\_by\_shop\_id

created\_at

---

### **🛒 order\_items**

order\_items  
\-------------  
id  
order\_id  
variant\_id  
product\_id  
qty  
unit\_price  
line\_total

---

### **🔔 order\_events**

order\_events  
\--------------  
id  
order\_id  
event\_type  
actor\_id  
notes  
created\_at

---

---

# **🟦 2️⃣ Order Types**

### **🟦 B2B Order**

Buyer  → Shop Owner  
Seller → Super Seller  
Bulk variants only  
No open broadcast  
No negotiation  
OTP optional (Admin policy)

---

### **🟢 B2C Direct Order**

Buyer  → Consumer  
Seller → Shop Owner  
Retail variants only  
No broadcast  
No negotiation  
Platform pricing rules applied  
OTP required

---

### **🤖 Open Order (B2C Smart Match)**

Buyer → Consumer  
Seller → NULL initially  
Broadcast enabled  
First accept wins  
Price negotiation enabled  
OTP required after negotiation

---

---

# **⚙️ 3️⃣ Order Status Flow (Updated)**

### **📌 Universal Status**

DRAFT  
PENDING  
OPEN  
LOCKED  
NEGOTIATING  
CONFIRMED  
PROCESSING  
OUT\_FOR\_DELIVERY  
DELIVERED  
CANCELLED  
EXPIRED  
CLOSED

---

### **🤖 Open Order Flow**

OPEN  
   ↓ (Shop Accepts)  
LOCKED  
   ↓ (Vendor submits price within 100 sec)  
NEGOTIATING  
   ↓ (Consumer Accepts)  
CONFIRMED  
   ↓  
PROCESSING  
   ↓  
OUT\_FOR\_DELIVERY  
   ↓  
DELIVERED  
   ↓  
CLOSED

Timeout Paths:  
OPEN → EXPIRED  
LOCKED → EXPIRED (no price submit)  
NEGOTIATING → EXPIRED (consumer no response)

---

---

# **🔐 4️⃣ Inventory Locking Integration**

Order Created:  
available\_qty ↓  
reserved\_qty ↑

Order Confirmed:  
reserved\_qty ↓ (OUT)

Order Cancelled / Expired:  
reserved\_qty → available\_qty

---

---

# **🔑 5️⃣ OTP Control Logic**

### **📲 OTP Rules**

OTP required for:  
✔ B2C Direct Order  
✔ Open Order (after price accepted)  
---

### **🚦 OTP Limit Rule (Open Order Only)**

If shop.pending\_open\_orders\_with\_otp \>= 2:  
    Do NOT send new open order notification

👉 Direct orders এই রুলে আটকে যাবে না।

---

---

# **💰 6️⃣ Price Negotiation Logic (Open Order Only)**

---

### **⏱ Vendor Window**

After order LOCKED:  
Vendor has 100 seconds to submit:  
✔ New product price  
✔ Delivery charge

---

---

### **🧾 Vendor Submission**

vendor\_price  
delivery\_charge  
total\_price

Saved into:

vendor\_price\_snapshot  
price\_delta  
negotiation\_status \= submitted

---

---

### **👤 Consumer Decision**

Consumer sees:  
✔ Original platform price  
✔ Vendor proposed price  
✔ Difference (+ / \-)

Options:  
\[ Accept \] → Order CONFIRMED  
\[ Reject \] → Order CANCELLED

---

---

# **🧮 7️⃣ Pricing Rules**

Platform sets base\_price  
Shop Owner sets shop\_price (within range)  
Open Order starts with platform base price  
Vendor may override during negotiation

---

---

# **🚫 8️⃣ Cancel & Return Rules**

### **❌ Cancel**

If delivery\_status \!= PICKED:  
    Cancel allowed

---

### **♻️ Return**

If delivery\_status \== PICKED or later:  
    Return allowed

(Return system already defined separately)

---

---

# **📍 9️⃣ Open Order Matching Logic (Enhanced)**

Eligible shop must satisfy:  
✔ Same product  
✔ Distance \<= 5km  
✔ Stock available  
✔ Shop active  
✔ Area permission allowed  
✔ Allowed product model  
✔ Seller enabled  
✔ OTP pending \< 2

---

---

# **🛡️ 10️⃣ Safety & Abuse Prevention**

✔ Atomic accept lock  
✔ Negotiation timeout auto-expire  
✔ OTP abuse limit  
✔ Ledger driven inventory  
✔ Full audit trail

# **FINAL POLISHED VERSION (v2.1 – Developer Ready)**

আপনি চাইলে নিচের আপডেটেড ভার্সন ডেভেলপারকে দিতে পারেন।

---

# **🧾 Unified Order System Architecture (v2.1)**

(Production Ready Specification)

---

## **🧱 1️⃣ Core Order Entities**

### **📦 orders**

id  
order\_number  
order\_type (B2B / B2C / OPEN)

buyer\_id  
buyer\_role (shop\_owner / consumer)

seller\_id (dealer / shop\_owner / null)

consumer\_area\_id  
matched\_area\_id

status  
subtotal  
delivery\_charge  
delivery\_charge\_snapshot  
grand\_total

base\_price\_snapshot  
vendor\_price\_snapshot  
price\_delta

payment\_status  
delivery\_status

otp\_code  
otp\_expires\_at  
otp\_verified\_at  
pending\_otp\_flag

negotiation\_deadline\_at  
negotiation\_status (pending / submitted / accepted / expired)

location\_lat  
location\_lng

expires\_at  
locked\_at  
open\_broadcasted\_at  
accepted\_by\_shop\_id

created\_at

---

### **🛒 order\_items**

id  
order\_id  
variant\_id  
product\_id  
qty  
unit\_price  
line\_total

---

### **🔔 order\_events**

id  
order\_id  
event\_type  
actor\_id  
notes  
created\_at

---

---

## **🟦 2️⃣ Order Types**

### **🟦 B2B Order**

✔ Buyer → Shop Owner  
 ✔ Seller → Super Seller  
 ✔ Bulk only  
 ✔ No broadcast  
 ✔ No negotiation  
 ✔ OTP optional

---

### **🟢 B2C Direct Order**

✔ Buyer → Consumer  
 ✔ Seller → Shop Owner  
 ✔ Retail only  
 ✔ No broadcast  
 ✔ No negotiation  
 ✔ Platform pricing enforced  
 ✔ OTP required

---

### **🤖 Open Order**

✔ Buyer → Consumer  
 ✔ Seller → NULL initially  
 ✔ Broadcast enabled  
 ✔ First accept wins  
 ✔ Price negotiation enabled  
 ✔ OTP required after acceptance

---

---

## **⚙️ 3️⃣ Order Status Flow**

DRAFT  
PENDING  
OPEN  
LOCKED  
NEGOTIATING  
CONFIRMED  
PROCESSING  
OUT\_FOR\_DELIVERY  
DELIVERED  
CANCELLED  
EXPIRED  
CLOSED

---

### **🤖 Open Order Flow**

OPEN  
 → LOCKED  
 → NEGOTIATING  
 → CONFIRMED  
 → PROCESSING  
 → OUT\_FOR\_DELIVERY  
 → DELIVERED  
 → CLOSED

Timeout:

OPEN → EXPIRED  
LOCKED → EXPIRED  
NEGOTIATING → EXPIRED

Reject handling:

If consumer rejects AND time remains:  
    status → OPEN  
Else:  
    status → EXPIRED

---

---

## **🔐 4️⃣ Inventory Locking**

On LOCKED:  
    available\_qty ↓  
    reserved\_qty ↑

On CONFIRMED:  
    reserved\_qty ↓ (OUT)

On CANCEL / EXPIRED:  
    reserved\_qty → available\_qty

---

---

## **🔑 5️⃣ OTP Control Logic**

OTP required for:  
\- B2C Direct  
\- Open Order (after negotiation)

If shop.pending\_open\_orders\_with\_otp \>= 2:  
    Block new open order notifications

OTP expiry:

If otp expired and not verified:  
    Auto cancel / expire order

---

---

## **💰 6️⃣ Price Negotiation (Open Only)**

Vendor window: 100 seconds

Vendor submits:

vendor\_price  
delivery\_charge  
total\_price

Validation:

min\_price \<= vendor\_price \<= max\_price

Snapshots saved.

Consumer:

Accept → CONFIRMED  
Reject → back to OPEN (if time remains)

---

---

## **🧮 7️⃣ Pricing Rules**

✔ Admin sets base price  
 ✔ Shop sets selling price  
 ✔ Open order starts with base price  
 ✔ Vendor override allowed

---

---

## **🚫 8️⃣ Cancel & Return**

If delivery\_status \!= PICKED:  
    Cancel allowed

If delivery\_status \>= PICKED:  
    Return allowed

---

---

## **📍 9️⃣ Open Order Matching Filters**

✔ Product match  
 ✔ Distance \<= 5km  
 ✔ Stock available  
 ✔ Shop active  
 ✔ Area permission  
 ✔ Allowed product model  
 ✔ Seller enabled  
 ✔ OTP pending \< 2

---

---

## **🛡️ 10️⃣ Safety Rules**

✔ Atomic accept lock  
 ✔ Negotiation timeout  
 ✔ OTP abuse protection  
 ✔ Ledger based stock  
 ✔ Full audit trail

# Last

✔ Super Seller এবং Shop Owner — **একই Product Code ব্যবহার করবে**  
 ✔ পার্থক্য হবে শুধু:

* কোন ভ্যারিয়েন্ট (TRADE / RETAIL)

* কার ইনভেন্টরিতে আছে

* কিভাবে কনভার্ট হচ্ছে

✔ যখন:

Shop Owner → Super Seller থেকে Bulk কিনবে

তখন:

Super Seller এর TRADE স্টক কমবে  
Shop Owner এর RETAIL স্টক বাড়বে (Auto Conversion)

✔ এরপর:

Consumer → Shop Owner থেকে কিনলে

তখন:

Shop Owner এর RETAIL স্টক কমবে  
---

**Unified SKU \+ Auto Inventory Conversion** 

---

**Product Identity Rule**  
✔ Product Code (SKU) globally unique থাকবে  
✔ Super Seller ও Shop Owner একই SKU দেখবে  
✔ Variant আলাদা হবে (TRADE / RETAIL)

### **উদাহরণ**

| Level | SKU | Variant |
| ----- | ----- | ----- |
| Super Seller | AT-IF-1001 | TRADE (50kg Sack) |
| Shop Owner | AT-IF-1001 | RETAIL (1kg Loose / 5kg Pack) |

---

**Inventory Ownership Model**  
Super Seller Inventory  
    (TRADE Variant)  
        ↓ B2B Order  
Auto Conversion Engine  
        ↓  
Shop Owner Inventory  
    (RETAIL Variant)  
        ↓ B2C Sale  
Consumer  
---

**Stock Movement Logic**

---

**Scenario A — Seller buys from Super Seller (Bulk Purchase)**

Example:

Shop Owner buys:  
2 Sack (50kg each)  
Total \= 100kg  
---

**System Actions**

#### **Step–1: Super Seller Inventory**

TRADE Sack Stock  
\-2 Sack  
---

**Step–2: Auto Conversion Engine**  
Conversion Rule:  
1 Sack \= 50 KG Loose Retail  
---

**Step–3: Shop Owner Inventory**  
RETAIL Loose Stock  
\+100 KG  
---

👉 এখানে:  
 ✔ Super Seller bulk কমলো  
 ✔ Shop Owner retail বাড়লো  
 ✔ Trade stock Shop Owner-এ থাকলো না

---

**Scenario B — Consumer buys from Shop Owner**

Example:

Consumer buys:  
5 KG Loose  
---

**System Actions**  
Shop Owner RETAIL Inventory  
\-5 KG  
---

**🔁 Scenario C — Seller buys carton pack instead of loose**

Example:

1 Carton \= 10 × 5KG Pack

System:

Super Seller TRADE Carton \-1  
Shop Owner RETAIL Pack \+10  
---

**Core Objective**

✔ হোমপেজে প্রোডাক্ট লিস্ট দেখাবে  
 ✔ একই সাথে ঐ প্রোডাক্ট কোন কোন সেলার বিক্রি করছে তা দেখা যাবে  
 ✔ কনজুমার সরাসরি সেলারের স্টোরে ঢুকতে পারবে  
 ✔ প্রোডাক্ট লিস্ট পেজ থেকেও সেলার দেখা যাবে  
 ✔ ক্যাটাগরি সিলেক্ট করলে ঐ ক্যাটাগরির সেলার লিস্ট আসবে  
 ✔ সবকিছু একই সার্চ / ফিল্টার সিস্টেম থেকে হবে

---

**Product Card** 

প্রতিটি প্রোডাক্ট কার্ডে থাকবে:

\[ Product Image \]  
Product Name  
Brand  
Base Price (From Platform)  
Available Sellers Count (e.g. 3 sellers)

Buttons:  
\[ View Product \]  
\[ View Sellers \]  
---

**Seller Preview (Popup / Bottom Sheet)**

যখন "View Sellers" ক্লিক করবে:

Seller Name  
Distance  
Seller Price  
Rating  
\[ Visit Store \]  
---

👉 এখান থেকেই কনজুমার সেলারের স্টোরে ঢুকতে পারবে।

---

**Seller Store Page**

যখন কনজুমার কোনো সেলার সিলেক্ট করবে:

Store Profile  
Seller Rating  
Delivery Area  
Store Product List (Only allowed products)  
Seller Price shown  
Add to Cart / Order  
---

✔ এখান থেকেই অর্ডার হবে।

---

**Unified Search System**

---

**🔎 Search Result Tabs**

\[ Products \]   \[ Sellers \]   \[ Categories \]  
---

**Products Tab**  
Product Card  
\+ Seller Count  
\+ Min Price

Click → Product Detail → Seller List

---

**Sellers Tab**

Seller Card  
\+ Distance  
\+ Category tags

Click → Seller Store

---

**Categories Tab**

Category List  
\+ Seller Count

Click → Category View

---

**Category Based Discovery Flow**

### **🎯 Example**

User selects:

Category → Rice  
---

**System Shows**  
Tab 1: Rice Products  
Tab 2: Sellers selling Rice  
---

**UI Layout**  
\[Rice Products Grid\]  
\[Rice Sellers List\]  
---

👉 একই স্ক্রিনে দুইটাই দেখা যাবে

---

**🎯 Core Concept**

প্রতিটা Shop Owner এর থাকবে:

1️⃣ Public Store Page (Customer Facing Mini Website)  
2️⃣ Internal Dashboard (Seller Management Panel)

QR / URL সবসময় যাবে 👉 **Public Store Page**

---

 **Store Page (Consumer View)**

URL Example:

bikalpo.com/store/rahman-store  
QR Code → same URL  
---

**Page Layout**

### **Header Section**

Store Logo  
Store Name  
Tagline (Optional)  
Rating ⭐⭐⭐⭐☆  
Delivery Area  
Open / Closed Status  
Call Button  
WhatsApp Button  
---

**Navigation Tabs**  
\[ Products \] \[ Offers \] \[ About Store \] \[ Reviews \]  
---

**Products Tab**  
Grid of Products  
Product Image  
Name  
Seller Price  
Stock Status  
\[ Add to Cart \]  
\[ View Details \]  
---

**Offers Tab**  
Special Offers for this Store  
\- Customer-specific discounts  
\- Bundle offers  
\- Time limited offers

যদি কনজুমার লগইন করা থাকে → তার জন্য পার্সোনাল অফার দেখাবে।

---

**About Store Tab**

Shop Address  
Owner Name  
Delivery Policy  
Payment Options  
Return Policy  
Business Hours  
---

**⭐ Reviews Tab**  
Customer Ratings  
Comments  
Photos  
---

**Seller Internal Dashboard (Management Panel)**

This is visible only to seller after login.

---

**🧩 Dashboard Sections**

### **📊 Overview**

Today Sales  
Pending Orders  
Total Customers  
Active Offers  
Upwork view  
---

**Products**  
View allowed products  
Set retail price  
Stock visibility  
---

**Orders**  
Incoming orders  
Open order accept  
Delivery tracking  
---

**Offers**

Schedule offers

---

**⚙️ Settings**  
Store Profile  
QR Download  
Delivery Rules  
Business Hours  
---

**ORDER AUTO-SPLIT ENGINE**

👉 **একটা Cart → একাধিক Sub-Order → একাধিক Seller**

Consumer ভাবে সে **একটা অর্ডার করছে**,  
 কিন্তু সিস্টেম ভিতরে ভিতরে অর্ডার **ভেঙে ফেলবে (split করবে)**।

---

**🧠 CONCEPT**

### **🛒 Consumer Cart (Virtual)**

Consumer adds:

* Rice

* Dal

* oil

UI তে দেখাবে:  
 ✅ 3 items — 1 checkout

---

**⚙️ SYSTEM DOES:**

### **STEP 1 — GROUP BY ELIGIBLE SELLER**

System checks for each product:

✔ Which sellers are allowed by product model  
 ✔ Which sellers have stock  
 ✔ Which sellers are active in area

Then groups items:

### **Example**

### **🟢 Sub-Order A → Seller: Shop X**

* Rice

* Dal

### **🟢 Sub-Order B → Seller: Shop Y**

* oil

---

**🧾 INVOICE LOGIC**

### **Consumer View**

Consumer sees:

### **🧾 Invoice Summary**

Order \#ORD-1001  
 Total: ৳1200

### **Seller Wise Breakdown**

#### **Invoice – Shop X**

Rice, Dal  
 Subtotal ৳700

#### **Invoice – Shop Y**

oil  
 Subtotal ৳500

---

**OPEN ORDER \+ SPLIT COMBINATION**

For OPEN order:

System will try:

### **Step 1**

Try to find **single seller** who can supply all items.

If found → normal open order.

### **Step 2**

If not found → Auto Split into multiple open orders.

Each sub-order broadcasted separately.

Consumer still sees:

“Your order is being processed by multiple nearby sellers.”

---

**OPEN ORDER — PRICE NEGOTIATION SYSTEM** 

# **🎯 CORE IDEA**

✔ Consumer platform price দিয়ে order দেয়  
 ✔ Eligible sellers order pick করে (LOCK)  
 ✔ Seller তার final price \+ delivery charge propose করে  
 ✔ Consumer accept / reject করে  
 ✔ Accept করলে order CONFIRMED → OTP → Delivery

---

**BROADCAST TO ELIGIBLE SELLERS**

System filters sellers:

✔ Product allowed by model  
 ✔ Area permission  
 ✔ Stock available  
 ✔ pending\_otp \< 2

Push Notification:

New Open Order Available

---

**SELLER PICKS ORDER** 

First seller who clicks Accept:

status \= LOCKED

seller\_id \= shop\_id

locked\_at \= now

negotiation\_deadline \= now \+ 100 sec

Inventory:  
 ✅ Reserve stock now

Other sellers:

❌ order disappears

---

# **🤖 OPEN ORDER — PICK → NEGOTIATE → SUBMIT (LOCKED WORKFLOW)**

## **🎯 CORE RULE (MOST IMPORTANT)**

### **✅ Rule–1: Order Pick না করলে Price** Difference  **Edit করা যাবে না**

Seller শুধুমাত্র তখনই পারবে:

* Delivery Charge Edit করতে

* Difference দেখতে

👉 যখন সে আগে **ORDER PICK (LOCK)** করেছে।

After Pick:  
 ✅ Difference visible  
 ✅ Submit enabled

🔒 **Seller যখন একটি Open Order “Pick” করবে, তখন সে যতক্ষণ না পর্যন্ত সেই অর্ডারের Price Negotiation Submit করে, ততক্ষণ পর্যন্ত সে আর কোনো নতুন Open Order বা Price Negotiation নোটিফিকেশন পাবে না।**

✋ **Order Pick না করলে Seller কোনো Price  Difference Box দেখতে বা এডিট করতে পারবে না।**

---

**STEP 4 — SELLER SUBMITS PRICE**

Seller sees:

| Platform Price | Editable Seller Price | Qty  | Unit Price | Platform Price | Seller Price(Unit Price) |
| ----- | ----- | :---- | :---- | :---: | ----- |
| RICE-5500 | PRAN Mustard Oil 1L | 2  | 250  | 500 | 280 |
| RICE-5590 | Rice Nazirshail 5kg  | 1 | 450 | 450 | 430 |

Base Price/Platform Price \-1200 Seller price \-1150

Delivery: ৳40  
 Difference: \+৳50

SUBMITTED

\-------------------------------------------------------------

\-------------------------------------------------------------

Seller submits:

vendor\_price

delivery\_charge

total\_price

negotiation\_status \= SUBMITTED

Must submit within **100 seconds**.

If not:

status \= EXPIRED

---

**STEP 5 — CONSUMER DECISION**

**🧾 INVOICE LOGIC**

### **Your order split more invoice( your products are not available one seller)** 

### **Consumer View**

Consumer sees:

### **🧾 Invoice Summary**

Order \#ORD-1001  
 Total: ৳1200

### **Seller Wise Breakdown**

#### **Invoice – Shop X \-1**

Rice, Dal….. 3 product  
 Subtotal ৳700

Buttons:

\[ Accept Offer \]  
 \[ Reject Offer \]

#### **Invoice – Shop X \-2**

Rice, Dal….. 3 product  
 Subtotal ৳650

Buttons:

\[ Accept Offer \]  
 \[ Reject Offer \]

#### **Invoice – Shop X \-3**

Rice, Dal….. 3 product  
 Subtotal ৳700

Buttons:

\[ Accept Offer \]  
 \[ Reject Offer \]

#### **Invoice – Shop Y-1**

Gas  
 Subtotal ৳520

Buttons:

\[ Accept Offer \]  
 \[ Reject Offer \]

#### **Invoice – Shop Y-2**

Gas  
 Subtotal ৳480

Buttons:

\[ Accept Offer \]  
 \[ Reject Offer \]

#### **Invoice – Shop Y-3**

Gas  
 Subtotal ৳500

Buttons:

\[ Accept Offer \]  
 \[ Reject Offer \]

### **Consumer View**

Consumer sees:

### **🧾 Invoice Summary**

Order \#ORD-1001  
 Total: ৳1200

Accept Offer

#### **Shop Y-3  \- 500**

#### **Shop X \-2 \- 650**

My order  price: 1200  
 Seller price: 1150  
 Delivery: ৳40  
 Difference: \+৳50

দুটি কালার থাকবে

Seller see:

---

**STEP 6A — IF CONSUMER ACCEPTS**

status \= CONFIRMED

otp\_generated

inventory\_reserved → final OUT after delivery

Seller notified:

Order Confirmed, prepare delivery

অন্যান্য যারা প্রাইস নিগোসিয়েশনে পার্টিসিপেট করছে অন্য কেউ দেখতে পাবে যে এই অর্ডারটি অন্য কাউকে দেয়া হয়েছে বা এক্সেপ্ট করছে 

---

**❌ STEP 6B — IF CONSUMER REJECTS**

status \= CANCELLED

inventory released

Options:

✔ Try another seller  
 ✔ Cancel whole order

---

**ANTI-ABUSE RULES**

## **OTP LIMIT (VERY IMPORTANT)**

If seller has:

pending\_otp \>= 2

Then:

❌ no new open order broadcast

Prevents order blocking.

---

   **SUMMARY**

## **👤 Consumer**

Order Status:

OPEN → Waiting Seller  
 LOCKED → Seller preparing offer  
 NEGOTIATING → Review price  
 CONFIRMED → OTP received

---

## **🏪 Seller**

Buttons:

\[ Accept Order \]  
 → price form  
 → submit within 100 sec

---

**🎯 RULE**

👉 **প্রতি Sub-Order যাবে শুধু ঐ Product \+ Model \+ Area eligible Seller দের কাছে।**

❌ পুরো এরিয়ার সব Seller কে যাবে না  
 ❌ unrelated category Seller কে যাবে না

---

# **🧩 WHY SPLIT IS MANDATORY**

আপনার Scenario:

Consumer ordered:

* Rice

* Dal

* Oil

But:

Seller A → Rice \+ Dal  
 Seller B → Oil only

So system must create:

### **🧾 Master Order**

For consumer view only.

### **📦 Sub-Order \#1 → Seller A**

Rice \+ Dal

### **📦 Sub-Order \#2 → Seller B**

Oil

---

# Login

**Bikalpo.com**

# **Master Project Overview —** 

**Type:** Location Based Multi-Vendor Marketplace (B2B \+ B2C \+ Open Order \+ Service Hub)

**Hybrid Role Activation Model**   
---

## **👤 Consumer (Default User)**

### **Flow**

Install App  
→ Sign Up (Phone OTP)  
→ Automatically Consumer Account Created  
→ Direct Home Screen

✔ কোনো role select নেই  
 ✔ কনজুমার জানবেই না অন্য রোল আছে  
 ✔ Zero friction onboarding

---

---

## **🏪 Shop Owner (Seller)**

### **Flow**

Install App  
→ Sign Up  
→ Consumer Account Created  
→ Apply for Business Account  
→ Submit Documents  
→ Admin Approval  
→ Role upgraded to Shop Owner

---

### **UI Button (Inside App)**

"Become a Business Seller"

✔ Admin verification বাধ্যতামূলক  
 ✔ Fake seller ঢুকতে পারবে না  
 ✔ ভবিষ্যতে model assign সহজ হবে

---

---

## **👷 Employee**

### **Flow**

Admin creates employee account  
→ SMS invite sent  
→ Employee installs app  
→ Login using phone  
→ Auto assigned role \= employee

---

✔ Employee নিজে role select করতে পারবে না  
 ✔ Security strong  
 ✔ Audit friendly

---

---

# **🔐 Role Assignment Rule (System Level)**

Default Role \= consumer

Only Admin can:  
✔ Upgrade to shop\_owner  
✔ Create employee  
✔ Assign permissions

---

---

# Service Hub

# **Homepage → Service Hub Module Architecture**

## **(Universal Public Service & Listing System)**

---

## **🎯 Core Objective**

✔ হোমপেজে একটি নিউট্রাল লিংক থাকবে  
✔ লিংকে ক্লিক করলে সবাই একটি Service Hub পেইজে যাবে  
✔ সেখানে সার্ভিস সম্পর্কে ধারণা পাবে  
✔ Consumer লিস্টিং ব্রাউজ ও সার্চ করতে পারবে  
✔ শুধুমাত্র Consumer role-এর লগইন ইউজার লিস্টিং পোস্ট করতে পারবে  
✔ Shop Owner / Admin / Employee লিস্টিং পোস্ট করতে পারবে না  
✔ সব লিস্টিং মাস ভিত্তিক Auto Expire হবে  
✔ Default ভাবে ৫ কিমি radius এর ভিতরের লিস্টিং আগে দেখাবে  
✔ কোনো নির্দিষ্ট ইউজ-কেস হার্ডকোড করা হবে না  
✔একজন Consumer একাধিক লিস্টিং পোস্ট করতে পারবে   
---

**🏠 1\. Homepage Integration**  
---

## **🔗 Navigation Placement**

### **Header Menu**

Menu Item Label:  
"Services" / "Explore" / "Community"  
---

---

**Footer Link**  
Quick Links → Services  
---

**🔁 Navigation Flow**  
Homepage  
   ↓ Click  
/services  
(Service Hub Landing Page)  
---

# **Listing-as-Product Architecture**

## **(Rental / Space Advertisement as Product Model)**

---

# **🎯 Core Concept**

✔ প্রতিটা বিজ্ঞাপন \= একটি Product  
✔ Product List Page এ কার্ড আকারে দেখাবে  
✔ Product Detail Page এ পূর্ণ ডিটেইল দেখাবে  
✔ Add to Cart নাই — Direct Contact থাকবে  
✔ Price informational (rent / charge)  
✔ Inventory \= Not applicable

---

---

# **🧱 1️⃣ PRODUCT LIST PAGE (Service Product Grid)**

এই পেজে ইউজার দ্রুত স্ক্যান করে বুঝবে কী অফার আছে।

---

## **🧾 Product Card Structure**

\[Cover Image\]

Title  
\--------------------------------  
"Rent  \- 2 Room Space  (180 ft)" Family   
Rent \-Sub \-Falily 

Location (Area \+ Landmark)  
\--------------------------------  
Mirpur 10, Near Metro Station  
Key Highlights (icons)  
\--------------------------------  
✔ 2 Rooms  
✔ Private Access  
✔ Water \+ Gas

Posted Time  
\--------------------------------  
Posted 2 days ago

Buttons  
\--------------------------------  
\[ View Details \]  
\[ Call Now \]

---

---

## **🔎 Filters (Product Listing Page)**

✔ Area / Location  
✔ Size / Rooms  
✔ Posted Date

---

**2️⃣ PRODUCT DETAILS PAGE**

## **(একটা বিজ্ঞাপনের সম্পূর্ণ তথ্য)**

এটাই সবচেয়ে গুরুত্বপূর্ণ।

আমি এটাকে সেকশন করে দিচ্ছি।

---

---

## **🖼️ A. Media Gallery**

✔ Multiple Photos  
✔ Optional Video  
✔ Zoom / Slider

---

---

## **🏷️ B. Title & Quick Summary**

Title  
Short Description  
Listing ID  
Posted Date  
Availability Status

---

---

## **📍 C. Location Information**

Area Name  
Full Address (Optional hidden)  
Nearby Landmark  
Map Preview (Optional)  
Access Instructions

---

---

## **💰 D. Pricing Information**

Monthly / Fixed Rent :Hide all time   
Advance / Deposit (if any): yes or No  
Service Charge (if any): yes or No  
Utility Cost (if any): yes or No  
Gas Cost (if any): yes or No  
Other Charges (if any): yes or No  
---

## **🏠 E. Space / Property Information**

(নিউট্রাল ভাষা)

Total Size (sqft / capacity)  
Number of Rooms  
Floor Level  
Facing / Ventilation  
Condition (New / Used / Renovated)  
Usage Type (Family / Office / Shared / Storage)

---

---

## **🚿 F. Facilities & Services**

Checkbox style:

✔ Water Supply  
✔ Gas Supply  
✔ Electricity Backup  
✔ Internet Ready  
✔ Elevator  
✔ Parking  
✔ Security  
✔ Caretaker Available  
✔ Cleaning Service  
✔ Furnished / Semi Furnished  
✔ Private Entrance

---

---

## **👤 G. Contact & Ownership Info**

Contact Person Name  
Phone Number  
Alternate Phone (Optional)  
Caretaker Available? (Yes / No)  
Preferred Contact Time

---

---

## **📜 H. Rules & Restrictions**

Visitor policy  
Pets allowed or not  
Smoking allowed or not  
---

## **📝 I. Additional Notes**

Free text notes from owner  
---

**🚩 J. Actions**  
\[ Call \]  
\[ WhatsApp \]  
\[ Save Listing \]  
\[ Report Listing \]  
---

Consunare can post Advistisment ?

# Offer module

OFFER SYSTEM ARCHITECTURE — Bikalpo.com  
(Admin Creates → Seller Activates → Consumer Receives)  
🧠 CORE BUSINESS PHILOSOPHY  
✔ Offer তৈরি করবে শুধু Admin  
✔ Seller নিজের মতো Offer বানাবে না  
✔ Seller শুধু Admin-এর Offer Library থেকে ON/OFF করবে  
✔ Consumer কিছু configure করবে না — শুধু Auto Benefit পাবে  
✔ Offer কখনো Base Price নষ্ট করবে না, শুধু Adjustment হবে  
🧱 DATABASE DESIGN  
📦 offer\_templates (Admin Controlled Library)  
Copy code

id  
code  
name  
description

offer\_type  
(order\_total / product / category / model / customer / seller)

discount\_type  
(percent / flat / free\_delivery)

discount\_value

min\_order\_amount  
max\_discount\_amount

target\_product\_id (nullable)  
target\_category\_id (nullable)  
target\_model\_id (nullable)

customer\_rule\_json  
seller\_rule\_json

valid\_from  
valid\_to

status (active / inactive)  
created\_at  
👉 এখানে Admin সব ধরনের Offer তৈরি করবে  
🏪 shop\_active\_offers  
Copy code

id  
shop\_id  
offer\_template\_id

is\_active (true/false)  
activated\_at  
deactivated\_at  
👉 Seller শুধু ON / OFF করবে  
🧾 order\_applied\_offers  
Copy code

id  
order\_id  
offer\_template\_id

discount\_amount  
applied\_rule\_snapshot (json)

created\_at  
👉 Order এ কোন offer apply হয়েছে তার প্রমাণ  
🧑‍💼 ADMIN PANEL — WHAT ADMIN DOES  
Admin Capabilities  
✔ Offer Template Create  
✔ Offer Type Select  
✔ Rule Configure  
✔ Validity Set  
✔ Activate / Deactivate  
✔ Abuse Monitor  
Admin Offer Create Flow  
Admin Dashboard → Offer Manager → Create Offer  
Select:  
• Offer Type  
• Discount Type  
• Rule Conditions  
• Valid Time  
• Eligible Products / Models / Areas  
Save → Goes to Offer Library  
🏪 SELLER PANEL — WHAT SELLER DOES  
Seller Cannot:  
❌ Create Offer  
❌ Change Discount  
❌ Change Rules  
Seller Can:  
✔ Browse Offer Library  
✔ Activate offer for own shop  
✔ Deactivate anytime  
Seller Offer Flow  
Shop Dashboard → Promotions → Available Offers  
Card shows:  
Offer Name  
Discount  
Conditions  
Valid Until  
Button:  
\[ Activate Offer \] / \[ Deactivate \]  
👤 CONSUMER EXPERIENCE  
Consumer Never Configures Offer  
They only see:  
✔ Discount auto applied  
✔ Offer name shown in cart  
✔ Savings amount visible  
Cart View Example  
Subtotal: ৳1,850  
Offer: Big Basket Bonus – ৳150  
Delivery: ৳60  
Grand Total: ৳1,760  
⚙️ OFFER ENGINE — APPLY LOGIC  
When Cart Calculated  
System checks:  
For each active shop\_offer:  
Offer validity  
Customer eligibility  
Product / Category / Model match  
Order total match  
If match → calculate discount  
Priority Rules  
✔ Only best offer auto applied  
OR  
✔ Multiple combinable offers allowed (Admin rule)  
Configurable in backend.  
🔐 ABUSE & SAFETY  
✔ Offer cannot reduce below cost margin  
✔ One order \= one use (if configured)  
✔ Time window enforced  
✔ Area & seller targeting possible  
✔ All discount logged  
🧩 OFFER TYPE MODELS (CLEAN STRUCTURE)  
TYPE A — ORDER TOTAL  
Example:  
• Min order ৳1500  
• Flat ৳100 off  
Config:  
offer\_type \= order\_total  
min\_order\_amount \= 1500  
discount\_type \= flat  
discount\_value \= 100  
TYPE B — PRODUCT  
Example:  
Gas Cylinder ৳50 off  
Config:  
offer\_type \= product  
target\_product\_id \= LPG  
discount\_type \= flat  
discount\_value \= 50  
TYPE C — MODEL / CATEGORY  
Example:  
Flour Specialist Model → 3% off  
Config:  
offer\_type \= model  
target\_model\_id \= Flour  
discount\_type \= percent  
discount\_value \= 3  
TYPE D — CUSTOMER TARGET  
Example:  
First Order Bonus  
customer\_rule\_json:  
Copy code

{  
  "order\_count": 0  
}  
TYPE E — SELLER BOOST  
Example:  
Low Sales Seller  
seller\_rule\_json:  
Copy code

{  
  "weekly\_orders\_less\_than": 5  
}  
🔥 WHY THIS MODEL MATCHES YOUR BUSINESS

# REASON AWARE

# **CONSUMER FEEDBACK & REASON AWARE NOTIFICATION SYSTEM**

## **🎯 Core Goal**

Consumer বুঝবে:

✔ কেন সে সেবা পাচ্ছে না  
 ✔ এটা সিস্টেম সমস্যা না, এলাকা ভিত্তিক সীমাবদ্ধতা  
 ✔ সে কী করতে পারে (local seller invite)

---

**🧭 SCENARIO–1**

## **Consumer → Seller Page → No Seller Found**

### **📍 Condition**

User goes to:

Home → Sellers  
 or  
 Category → Sellers

AND  
 System finds:

0 seller within 5km radius

---

**🟥 EMPTY SELLER LIST MESSAGE (UI BANNER)**

### **🔴 Primary Message**

❗ আপনার এরিয়ার ৫ কিলোমিটার ভিতরে বর্তমানে কোনো রেজিস্টার্ড সেলার নেই

### **🟡 Explanation Line**

এজন্য আপনি এই মুহূর্তে সরাসরি কোনো দোকান থেকে অর্ডার করতে পারছেন না

### **🟢 Action Suggestion**

👉 অনুগ্রহ করে আপনার কাছাকাছি কোনো পরিচিত দোকানকে  
 আমাদের প্ল্যাটফর্মে রেজিস্ট্রেশন করার জন্য অনুরোধ করুন

### **🔘 Button**

\[ 📩 সেলারকে অনুরোধ পাঠান \]

---

**🧭 SCENARIO–2**

## **Consumer → Search Product → Product Found but No Seller**

### **📍 Condition**

Product exists in system  
 BUT

No seller in area has this product allowed / in stock

---

**🟠 PRODUCT PAGE WARNING STRIP**

### **🟠 Message**

⚠ এই প্রোডাক্টটি আপনার এলাকায় বর্তমানে কোনো সেলার বিক্রি করছে না

### **🟡 Explanation**

আমাদের প্ল্যাটফর্মে এই প্রোডাক্ট আছে,  
 কিন্তু আপনার ৫ কিলোমিটার এরিয়ার ভিতরে কোনো সেলার এখনো এটি অ্যাক্টিভ করেনি

### **🟢 Suggestion**

আপনি চাইলে আপনার পরিচিত দোকানকে এই প্রোডাক্ট বিক্রি করার জন্য  
 আমাদের প্ল্যাটফর্মে যুক্ত হতে অনুরোধ করতে পারেন

### **🔘 Button**

\[ 📩 সেলারকে অনুরোধ পাঠান \]

---

**🧭 SCENARIO–3**

## **Open Order Submitted → No Seller Picked Within Time**

### **📍 Condition**

Open Order status \= OPEN  
 AND  
 No seller LOCKED before timeout

---

**⏱ TIME BASED USER FEEDBACK**

### **🟡 After First Time Window (e.g. 60 sec)**

Banner:

⏳ আপনার এলাকায় এখনো কোনো সেলার এই অর্ডারটি গ্রহণ করেনি  
 আমরা খোঁজ চালিয়ে যাচ্ছি...

(no action yet)

---

**🔴 After Final Timeout (e.g. 120 sec)**

Order status \= EXPIRED

### **🔴 Main Message**

❌ আপনার ৫ কিলোমিটার এরিয়ার ভিতরে কোনো সেলার এই অর্ডারটি গ্রহণ করেনি

### **🟡 Reason Explanation**

এর মানে হলো আপনার এলাকার সেলারদের কাছে  
 এই প্রোডাক্টের জন্য বর্তমানে আমাদের প্ল্যাটফর্মে কেউ অ্যাক্টিভ নেই

### **🟢 Suggestion**

👉 অনুগ্রহ করে আপনার কাছাকাছি কোনো দোকানকে  
 আমাদের প্ল্যাটফর্মে রেজিস্ট্রেশন করার জন্য অনুরোধ করুন

### **🔘 Buttons**

\[ 🔁 আবার চেষ্টা করুন \]  
 \[ 📩 সেলারকে অনুরোধ পাঠান \]

---

**🧭 SCENARIO–4**

## **Service Hub / Listing Section → No Service Found**

(তুমি যেই Service Hub এর কথা বলেছিলে)

### **📍 Condition**

Area based service query \= empty

---

**🟣 SERVICE NOT AVAILABLE MESSAGE**

### **🔴 Message**

😕 আপনার এলাকায় এই মুহূর্তে এই ধরনের কোনো সার্ভিস লিস্ট করা নেই

### **🟡 Explanation**

আমাদের প্ল্যাটফর্মে এই সার্ভিস সাপোর্ট করা হয়,  
 কিন্তু আপনার এরিয়ার জন্য এখনো কেউ লিস্টিং দেয়নি

### **🟢 Suggestion**

আপনি চাইলে পরিচিত কাউকে এখানে লিস্টিং দিতে অনুরোধ করতে পারেন

### **🔘 Button**

\[ 📩 সার্ভিস প্রোভাইডারকে অনুরোধ করুন \]

---

# **⏱ IMPORTANT — TIME DEPENDENT VISIBILITY RULE** 

✔ প্রথমে soft message  
 ✔ সময় পার হলে stronger message  
 ✔ তারপর invite option highlight হবে

Logic:

T0–60 sec → waiting message  
T60–120 sec → warning message  
After timeout → reason \+ invite CTA

# minimum\_b2b\_order\_amount

B2B ORDER FLOW (Shop Owner → Super Seller)  
🟦 B2B Order  
Buyer → Shop Owner  
Seller → Super Seller  
Bulk variants only  
👇  
এটা B2C বা Open Order এ যাবে না  
শুধু মাত্র B2B Order Type এ লাগু হবে।  
✅ Business Rule  
🎯 Rule  
Super Seller নির্ধারণ করবে:  
minimum\_b2b\_order\_amount \= ৳2000 / ৳5000 / configurable  
Validation Logic  
When Shop Owner clicks Place B2B Order:  
Copy code  
Text  
If order\_type \== B2B:  
    If cart\_subtotal \< minimum\_b2b\_order\_amount:  
        Block order submission  
👉 Order create হবে না  
👉 Inventory reserve হবে না  
✅ UI Behavior (Shop Owner Side)  
🛒 Cart Page (B2B Cart)  
If subtotal \< minimum amount  
🔴 Warning Banner  
❗ সর্বনিম্ন অর্ডার এমাউন্ট ৳5000  
আপনার বর্তমান কার্ট: ৳3200  
অনুগ্রহ করে আরো প্রোডাক্ট যোগ করুন  
Button State  
\[ Place Order \] → ❌ Disabled  
✅ Checkout Page (Extra Safety Check)  
যদি somehow checkout এ আসে:  
Modal Alert:  
⚠ এই অর্ডারটি সাবমিট করা যাবে না  
কারণ B2B সর্বনিম্ন অর্ডার এমাউন্ট পূরণ হয়নি (৳5000)  
Button:  
\[ Back to Cart \]

# Image

![][image1]![][image2]![][image3]

# Color and logo

# COLOR SYSTEM

BIKALPO — OFFICIAL BRAND COLOR SYSTEM  
🟢 PRIMARY BRAND COLOR (Main Identity)  
▶ Teal Green (Brand Core)  
HEX: \#1FA7A0  
Logo background  
Banner left block  
Poster header  
Standee top part  
App primary buttons

🔵 SECONDARY DARK COLOR (Trust \+ Footer)  
▶ Deep Teal Blue  
HEX: \#0E4F5C  
Bottom strip of banner  
Footer area  
Trust badges background  
Support section background

⚪ NEUTRAL BACKGROUND COLOR  
▶ Pure White  
HEX: \#FFFFFF

Message zones  
Product grid background  
Leaflet content area

🟡 ACTION / ATTENTION COLOR (CTA)  
▶ Bright Yellow  
HEX: \#F6C343

QR zone background  
“Scan to order” area  
Offer highlight

⚫ TEXT COLORS  
▶ Primary Text (Dark)  
HEX: \#12343B

Headline  
Important info  
▶ Secondary Text (Grey)  
HEX: \#6B7C85

Subtitle  
Descriptions  
🎯 DESIGN RULE   
সব মার্কেটিং ম্যাটেরিয়ালে থাকবে:  
🟢 Teal \= Brand  
⚪ White \= Content  
🟡 Yellow \= Action  
🔵 Dark Teal \= Trust/Footer  
❌ অন্য কালার ঢুকানো যাবে না  
❌ Red / Purple / Pink ব্যবহার করা যাবে না  
❌ Gradient বেশি করা যাবে না (clean রাখবে)  
Brand Colors (Must Follow):  
Teal: \#1FA7A0  
Dark Teal: \#0E4F5C  
Yellow: \#F6C343  
White: \#FFFFFF  
Text Dark: \#12343B  
Text Grey: \#6B7C85

# FONT & TYPOGRAPHY GUIDE

🅱️ BIKALPO — FONT & TYPOGRAPHY GUIDE  
🎯 Brand Personality  
Clean  
Professional  
Tech-enabled business  
Easy to read from distance  
👉 তাই font হবে: Bold, Simple, Sans-serif  
✅ PRIMARY BRAND FONT (Headlines / Titles)  
▶ ENGLISH  
Font: Poppins  
Styles:  
Bold (700) → Big titles, banners  
SemiBold (600) → Section headers  
Why:  
Rounded  
Very readable from distance  
Modern business feel  
▶ BANGLA  
Font: Hind Siliguri  
Styles:  
Bold → Headlines  
Medium → Subtitles  
Why:  
Clean Bangla  
Great for posters & banners  
Professional look  
✅ SECONDARY FONT (Subtitles & Small Text)  
▶ ENGLISH  
Font: Inter  
Styles:  
Regular (400)  
Medium (500)  
Use for:  
Descriptions  
Bullet points  
Process steps  
▶ BANGLA  
Font: Noto Sans Bengali  
Styles:  
Regular  
Medium  
Use for:  
Process explanation  
Support info  
Footer text  
❗ FONT COMBINATION RULE  
You must use only:  
Use Case  
Font  
Big Headline  
Poppins Bold / Hind Siliguri Bold  
Subtitle  
Poppins SemiBold / Hind Siliguri Medium  
Body Text  
Inter / Noto Sans Bengali  
CTA Text  
Poppins Bold / Hind Siliguri Bold  
❌ Do NOT use decorative fonts  
❌ Do NOT mix random Bangla fonts  
📐 FONT SIZE GUIDELINE (Print Focused)  
🪧 Roof Banner  
Headline: 120–160 pt  
Subtitle: 60–80 pt  
CTA text: 50–70 pt  
🖼 Poster / Standee  
Title: 70–100 pt  
Product name: 28–36 pt  
SKU / small text: 18–22 pt  
🧾 Leaflet  
Title: 28–36 pt  
Subtitle: 18–22 pt  
Body: 12–14 pt  
🎯 SPACING & ALIGNMENT RULE  
Use LEFT alignment mostly (more professional)  
Line spacing: 120–140%  
Do not crowd text near edges  
Always keep QR separate from text

# Tab 22

![][image4]

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,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>