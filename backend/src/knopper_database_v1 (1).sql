create database Knopper_Database;
use Knopper_Database;
-- show databases;


SET FOREIGN_KEY_CHECKS = 0;


-- 1. BRANCHES (Locations)

CREATE TABLE BRANCHES (
    branch_id INT PRIMARY KEY,
    branch_name VARCHAR(255) COMMENT 'e.g., Naga Main',
    branch_code VARCHAR(50) COMMENT 'e.g., K-NAGA'
);


-- 2. PRODUCTS (Global Definition)

CREATE TABLE PRODUCTS (
    product_id INT PRIMARY KEY,
    product_name_official VARCHAR(255) COMMENT 'Full Name',
    product_name_receipt VARCHAR(255) COMMENT 'Short Name',
    price_regular DECIMAL(10, 2) COMMENT 'Type 1',
    price_senior_pwd DECIMAL(10, 2) COMMENT 'Type 2',
    price_box_wholesale DECIMAL(10, 2) COMMENT 'Type 3',
    box_quantity INT COMMENT 'Items per box',
    total_stock_quantity INT COMMENT 'Sum of all Batches (Computed)',
    is_vat_exempt BOOLEAN COMMENT 'TRUE for VAT-exempt meds',
    is_active BOOLEAN COMMENT 'FALSE if discontinued',
    category_type ENUM('MEDICINE', 'GROCERY', 'EQUIPMENT')
);


-- 3. USERS (Staff & Audit)

CREATE TABLE USERS (
    user_id INT PRIMARY KEY,
    branch_id INT COMMENT 'Home Branch',
    username VARCHAR(100),
    full_name VARCHAR(255),
    role ENUM('admin', 'manager', 'staff'),
    is_active BOOLEAN,
    FOREIGN KEY (branch_id) REFERENCES BRANCHES(branch_id)
);


-- 4. SUPPLIERS

CREATE TABLE SUPPLIERS (
    supplier_id INT PRIMARY KEY,
    supplier_name VARCHAR(255)
);

-- 5. GONDOLAS (Location per Branch)
CREATE TABLE GONDOLAS (
    gondola_id INT PRIMARY KEY,
    branch_id INT,
    gondola_code VARCHAR(50),
    floor_area VARCHAR(100),
    FOREIGN KEY (branch_id) REFERENCES BRANCHES(branch_id)
);

-- 6. BRANCH INVENTORY (Stock per Branch)
CREATE TABLE BRANCH_INVENTORY (
    inventory_id INT PRIMARY KEY COMMENT 'e.g., 99001',
    branch_id INT COMMENT 'e.g., 101',
    product_id INT COMMENT 'e.g., 1001',
    gondola_id INT COMMENT 'e.g., 55',
    reorder_level INT COMMENT 'Minimum (Alert Level)',
    target_stock_level INT COMMENT 'Maximum (Restock To)',
    batch_number VARCHAR(100) COMMENT 'e.g., BATCH-A',
    expiry_date DATE COMMENT 'e.g., 2026-12-31',
    quantity_on_hand INT COMMENT 'e.g., 50',
    FOREIGN KEY (branch_id) REFERENCES BRANCHES(branch_id),
    FOREIGN KEY (product_id) REFERENCES PRODUCTS(product_id),
    FOREIGN KEY (gondola_id) REFERENCES GONDOLAS(gondola_id)
);

-- 7. STOCK ADJUSTMENTS
CREATE TABLE STOCK_ADJUSTMENTS (
    adjustment_id INT PRIMARY KEY COMMENT 'e.g., ADJ-1005 (Int representation)',
    inventory_id INT COMMENT 'Links to specific Batch/Branch Inventory',
    user_id INT COMMENT 'e.g., Manager Name',
    adjustment_type VARCHAR(50) COMMENT 'e.g., LOSS, DAMAGE, EXPIRED, COUNT_CORRECTION',
    quantity_adjusted INT COMMENT 'e.g., -5 (Removed 5), +2 (Found 2)',
    date_adjusted DATETIME COMMENT 'e.g., 2026-02-20 09:30',
    remarks TEXT COMMENT 'e.g., Bottle broken during cleaning',
    FOREIGN KEY (inventory_id) REFERENCES BRANCH_INVENTORY(inventory_id),
    FOREIGN KEY (user_id) REFERENCES USERS(user_id)
);

-- 8. TRANSFER MANIFEST (The Trip/Shipment Header)
CREATE TABLE TRANSFER_MANIFEST (
    manifest_id INT PRIMARY KEY COMMENT 'e.g., TM-2026-001 (Int representation)',
    user_id INT COMMENT 'e.g., Manager Name',
    from_branch_id INT COMMENT 'e.g., 101',
    to_branch_id INT COMMENT 'e.g., 102',
    date_departed DATETIME,
    date_received DATETIME,
    status VARCHAR(50),
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id),
    FOREIGN KEY (from_branch_id) REFERENCES BRANCHES(branch_id),
    FOREIGN KEY (to_branch_id) REFERENCES BRANCHES(branch_id)
);

-- 9. TRANSFER ITEMS (The Contents)
CREATE TABLE TRANSFER_ITEMS (
    transfer_item_id INT PRIMARY KEY,
    manifest_id INT,
    product_id INT,
    batch_number VARCHAR(100),
    quantity_sent INT,
    quantity_received INT,
    FOREIGN KEY (manifest_id) REFERENCES TRANSFER_MANIFEST(manifest_id),
    FOREIGN KEY (product_id) REFERENCES PRODUCTS(product_id)
);

-- 10. PRODUCT BARCODES
CREATE TABLE PRODUCT_BARCODES (
    barcode_id INT PRIMARY KEY,
    product_id INT,
    barcode_value VARCHAR(255) COMMENT 'The actual scanned string',
    barcode_type VARCHAR(50) COMMENT 'e.g., UNIT, BOX, LEGACY, PROMO',
    is_primary BOOLEAN COMMENT 'TRUE if this is the current standard',
    FOREIGN KEY (product_id) REFERENCES PRODUCTS(product_id)
);

-- 11. CHILD TABLES (Medicines, Groceries, Equipment)
CREATE TABLE MEDICINES (
    med_id INT PRIMARY KEY,
    product_id INT,
    generic_name VARCHAR(255),
    dosage VARCHAR(100),
    formulation VARCHAR(100),
    is_rx_required BOOLEAN,
    FOREIGN KEY (product_id) REFERENCES PRODUCTS(product_id)
);

CREATE TABLE GROCERIES (
    gro_id INT PRIMARY KEY,
    product_id INT,
    brand VARCHAR(255),
    weight_volume VARCHAR(100),
    is_perishable BOOLEAN,
    FOREIGN KEY (product_id) REFERENCES PRODUCTS(product_id)
);

CREATE TABLE EQUIPMENT (
    equip_id INT PRIMARY KEY,
    product_id INT,
    dimensions VARCHAR(100),
    material VARCHAR(100),
    warranty_months INT,
    FOREIGN KEY (product_id) REFERENCES PRODUCTS(product_id)
);

-- 12. PRODUCT_SUPPLIER_LINK
CREATE TABLE PRODUCT_SUPPLIER_LINK (
    link_id INT PRIMARY KEY,
    product_id INT,
    supplier_id INT,
    cost_per_unit DECIMAL(10, 2),
    FOREIGN KEY (product_id) REFERENCES PRODUCTS(product_id),
    FOREIGN KEY (supplier_id) REFERENCES SUPPLIERS(supplier_id)
);

-- 13. PURCHASE ORDERS
CREATE TABLE PURCHASE_ORDERS (
    order_id INT PRIMARY KEY COMMENT 'e.g., PO-2026-001 (Int representation)',
    supplier_id INT,
    branch_id INT COMMENT 'Which branch is receiving this?',
    created_by_user_id INT COMMENT 'Staff who drafted the PO',
    approved_by_user_id INT COMMENT 'Manager who authorized the PO',
    order_date DATETIME,
    status VARCHAR(50) COMMENT 'e.g., DRAFT, SENT, PARTIAL, RECEIVED, CANCELLED',
    total_amount DECIMAL(10, 2),
    remarks TEXT,
    FOREIGN KEY (supplier_id) REFERENCES SUPPLIERS(supplier_id),
    FOREIGN KEY (branch_id) REFERENCES BRANCHES(branch_id),
    FOREIGN KEY (created_by_user_id) REFERENCES USERS(user_id),
    FOREIGN KEY (approved_by_user_id) REFERENCES USERS(user_id)
);

-- 14. PURCHASE_ORDER_ITEMS
CREATE TABLE PURCHASE_ORDER_ITEMS (
    po_item_id INT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity_ordered INT,
    uom VARCHAR(50) COMMENT 'e.g., BOX, PC, CASE',
    conversion_factor INT COMMENT 'e.g., 100 (if 1 BOX = 100 PCS)',
    cost_at_time_of_order DECIMAL(10, 2) COMMENT 'Historical price at moment of PO',
    item_status VARCHAR(50) COMMENT 'e.g., PENDING, RECEIVED, BACKORDERED, CANCELLED',
    FOREIGN KEY (order_id) REFERENCES PURCHASE_ORDERS(order_id),
    FOREIGN KEY (product_id) REFERENCES PRODUCTS(product_id)
);

-- 15. RECEIVING REPORTS
CREATE TABLE RECEIVING_REPORTS (
    receipt_id INT PRIMARY KEY,
    order_id INT COMMENT 'Links to original PO',
    received_by_user_id INT COMMENT 'Who checked the boxes?',
    date_received DATETIME,
    supplier_invoice_no VARCHAR(100) COMMENT 'Supplier SI or DR number',
    receipt_notes TEXT,
    FOREIGN KEY (order_id) REFERENCES PURCHASE_ORDERS(order_id),
    FOREIGN KEY (received_by_user_id) REFERENCES USERS(user_id)
);

-- 16. RECEIPT ITEMS
CREATE TABLE RECEIPT_ITEMS (
    receipt_item_id INT PRIMARY KEY,
    receipt_id INT,
    po_item_id INT COMMENT 'Which line item from the PO?',
    quantity_received INT,
    batch_number VARCHAR(100) COMMENT 'Recorded on delivery',
    expiry_date DATE COMMENT 'Recorded on delivery',
    FOREIGN KEY (receipt_id) REFERENCES RECEIVING_REPORTS(receipt_id),
    FOREIGN KEY (po_item_id) REFERENCES PURCHASE_ORDER_ITEMS(po_item_id)
);

-- 17. CASHIER SHIFTS
CREATE TABLE CASHIER_SHIFTS (
    shift_id INT PRIMARY KEY COMMENT 'e.g., SFT-1001 (Int representation)',
    user_id INT COMMENT 'Cashier on duty',
    branch_id INT COMMENT 'Branch of operation',
    start_time DATETIME COMMENT 'Clock-in time',
    end_time DATETIME COMMENT 'Clock-out time',
    starting_cash DECIMAL(10, 2) COMMENT 'Initial float/change',
    expected_cash DECIMAL(10, 2) COMMENT 'System calculated sales',
    actual_cash DECIMAL(10, 2) COMMENT 'Physical count by cashier',
    discrepancy DECIMAL(10, 2) COMMENT 'Shortage or Overage',
    status VARCHAR(50) COMMENT 'e.g., OPEN, CLOSED, RECONCILED',
    FOREIGN KEY (user_id) REFERENCES USERS(user_id),
    FOREIGN KEY (branch_id) REFERENCES BRANCHES(branch_id)
);

-- 18. SALES HEADERS (The Receipt)
CREATE TABLE SALES_HEADERS (
    sale_id INT PRIMARY KEY COMMENT 'e.g., INV-2026-0001 (Int representation)',
    branch_id INT,
    user_id INT COMMENT 'Cashier/Staff',
    shift_id INT COMMENT 'Links to specific Cashier Shift',
    sale_date DATETIME,
    total_amount DECIMAL(10, 2),
    tax_amount DECIMAL(10, 2),
    discount_total DECIMAL(10, 2),
    payment_method VARCHAR(50) COMMENT 'e.g., CASH, GCASH, CARD',
    customer_type VARCHAR(50) COMMENT 'e.g., REGULAR, SENIOR, PWD',
    FOREIGN KEY (branch_id) REFERENCES BRANCHES(branch_id),
    FOREIGN KEY (user_id) REFERENCES USERS(user_id),
    FOREIGN KEY (shift_id) REFERENCES CASHIER_SHIFTS(shift_id)
);

-- 19. BRANCH SALES REPORTS
CREATE TABLE BRANCH_SALES_REPORTS (
    report_id INT PRIMARY KEY,
    branch_id INT,
    report_date DATE COMMENT 'The specific day or period covered',
    gross_sales DECIMAL(10, 2) COMMENT 'Sum of all Sales Headers',
    total_returns DECIMAL(10, 2) COMMENT 'Sum of all Sales Returns',
    net_sales DECIMAL(10, 2) COMMENT 'Gross Sales - Total Returns',
    total_tax_collected DECIMAL(10, 2),
    total_discounts_given DECIMAL(10, 2),
    total_transaction_count INT COMMENT 'Number of receipts issued',
    generated_at DATETIME COMMENT 'Timestamp of report finalization',
    report_status VARCHAR(50) COMMENT 'e.g., DRAFT, FINALIZED, AUDITED',
    FOREIGN KEY (branch_id) REFERENCES BRANCHES(branch_id)
);


-- 20. SALES DETAILS (Line Items)
CREATE TABLE SALES_DETAILS (
    sale_detail_id INT PRIMARY KEY,
    sale_id INT,
    inventory_id INT COMMENT 'Links to specific Batch/Expiry',
    quantity_sold INT,
    price_at_sale DECIMAL(10, 2) COMMENT 'Historical price',
    discount_applied DECIMAL(10, 2),
    FOREIGN KEY (sale_id) REFERENCES SALES_HEADERS(sale_id),
    FOREIGN KEY (inventory_id) REFERENCES BRANCH_INVENTORY(inventory_id)
);

-- 21. SALES RETURNS
CREATE TABLE SALES_RETURNS (
    return_id INT PRIMARY KEY COMMENT 'e.g., RET-2026-001 (Int representation)',
    sale_id INT COMMENT 'Links to original Invoice',
    branch_id INT COMMENT 'Where return is processed',
    user_id INT COMMENT 'Manager/Staff authorizing return',
    return_date DATETIME,
    total_refund_amount DECIMAL(10, 2),
    return_reason VARCHAR(255) COMMENT 'e.g., WRONG_ITEM, EXPIRED_UPON_OPENING, DEFECTIVE',
    FOREIGN KEY (sale_id) REFERENCES SALES_HEADERS(sale_id),
    FOREIGN KEY (branch_id) REFERENCES BRANCHES(branch_id),
    FOREIGN KEY (user_id) REFERENCES USERS(user_id)
);

-- 22. RETURN ITEMS
CREATE TABLE RETURN_ITEMS (
    return_item_id INT PRIMARY KEY,
    return_id INT,
    sale_detail_id INT COMMENT 'Links to specific line in original sale',
    quantity_returned INT,
    refund_amount_per_item DECIMAL(10, 2),
    back_to_stock BOOLEAN COMMENT 'TRUE if item is sealed and resellable',
    FOREIGN KEY (return_id) REFERENCES SALES_RETURNS(return_id),
    FOREIGN KEY (sale_detail_id) REFERENCES SALES_DETAILS(sale_detail_id)
);


SET FOREIGN_KEY_CHECKS = 1;

select * from PRODUCTS;

SELECT 
    p.product_id AS 'Id',
    
    -- 1. Barcode
    pb.barcode_value AS 'Barcode',
    
    -- 2. "Unnamed: 2" (Original Description)
    -- Note: Since the import script mapped 'Generic' to product_name_official, 
    -- we display that here. If you concatenated name+dosage, use that.
    p.product_name_official AS 'Description',
    
    -- 3. Generic Name
    COALESCE(m.generic_name, p.product_name_official) AS 'Generic',
    
    -- 4. Classification (Mapped back to string roughly)
    CASE p.category_type
        WHEN 'MEDICINE' THEN 'MEDICAL/MEDICINES SUPPLIES'
        WHEN 'GROCERY' THEN 'GROCERIES SUPPLIES'
        ELSE 'EQUIPMENT'
    END AS 'Classification',
    
    -- 5. Gondola
    g.gondola_code AS 'Gondola',
    
    -- 6. Supplier
    s.supplier_name AS 'Supplier',
    
    -- 7. Pack/Unit Size
    COALESCE(m.dosage, gro.weight_volume, 'Unit') AS 'Pack/Unit Size (Measure)',
    
    -- 8. Net Weight (This was empty in source, returning NULL)

    
    -- 9. Unit Cost
    psl.cost_per_unit AS 'UnitCost',
    
    -- 10. Expiration (Formatted MM/DD/YYYY)
    DATE_FORMAT(bi.expiry_date, '%m/%d/%Y') AS 'Expiration',
    
    -- 11. Lot Number
    bi.batch_number AS 'LotNumber',
    
    -- 12. Reorder Point
    bi.reorder_level AS 'Reorder Point',
    
    -- 13. Prices
    p.price_regular AS 'Regular Price',
    p.price_senior_pwd AS 'Senior/PWD Price',
    p.price_box_wholesale AS 'Wholesale Box Price'

FROM PRODUCTS p

-- Join Inventory for Branch 1 (BMC MAIN)
LEFT JOIN BRANCH_INVENTORY bi ON p.product_id = bi.product_id AND bi.branch_id = 1

-- Join Location
LEFT JOIN GONDOLAS g ON bi.gondola_id = g.gondola_id

-- Join Barcode (Primary)
LEFT JOIN PRODUCT_BARCODES pb ON p.product_id = pb.product_id AND pb.is_primary = TRUE

-- Join Specific Details
LEFT JOIN MEDICINES m ON p.product_id = m.product_id
LEFT JOIN GROCERIES gro ON p.product_id = gro.product_id

-- Join Supplier Data
LEFT JOIN PRODUCT_SUPPLIER_LINK psl ON p.product_id = psl.product_id
LEFT JOIN SUPPLIERS s ON psl.supplier_id = s.supplier_id;

-- ============================================================================
-- EXCEL ANALYTICS TABLES (For Manager Dashboard)
-- ============================================================================

-- 23. EXCEL_UPLOADS (Tracks uploaded Excel files)
CREATE TABLE EXCEL_UPLOADS (
    upload_id INT PRIMARY KEY AUTO_INCREMENT,
    branch_id INT COMMENT 'Branch that uploaded the file',
    user_id INT COMMENT 'Manager who uploaded',
    file_name VARCHAR(255) COMMENT 'Original filename',
    file_type ENUM('sales', 'products', 'inventory') COMMENT 'Detected file type',
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE COMMENT 'FALSE when replaced by newer upload',
    FOREIGN KEY (branch_id) REFERENCES BRANCHES(branch_id),
    FOREIGN KEY (user_id) REFERENCES USERS(user_id)
);

-- 24. SALES_ANALYTICS (Processed sales data from Excel)
CREATE TABLE SALES_ANALYTICS (
    sales_id INT PRIMARY KEY AUTO_INCREMENT,
    upload_id INT COMMENT 'Links to the Excel upload',
    transaction_date DATE,
    cashier_name VARCHAR(255),
    item_description TEXT,
    gross_sales DECIMAL(10, 2),
    net_profit DECIMAL(10, 2),
    quantity_sold INT,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    transaction_time TIME,
    invoice_number VARCHAR(100),
    FOREIGN KEY (upload_id) REFERENCES EXCEL_UPLOADS(upload_id) ON DELETE CASCADE
);

-- 25. PRODUCT_CATALOG (Processed product data from Excel)
CREATE TABLE PRODUCT_CATALOG (
    catalog_id INT PRIMARY KEY AUTO_INCREMENT,
    upload_id INT COMMENT 'Links to the Excel upload',
    item_code VARCHAR(100),
    item_description TEXT,
    category VARCHAR(100),
    selling_price DECIMAL(10, 2),
    cost_price DECIMAL(10, 2),
    current_stock INT,
    supplier_name VARCHAR(255),
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (upload_id) REFERENCES EXCEL_UPLOADS(upload_id) ON DELETE CASCADE
);

-- 26. INVENTORY_ANALYTICS (Processed inventory data from Excel)
CREATE TABLE INVENTORY_ANALYTICS (
    inventory_id INT PRIMARY KEY AUTO_INCREMENT,
    upload_id INT COMMENT 'Links to the Excel upload',
    item_code VARCHAR(100),
    item_description TEXT,
    current_stock INT,
    reorder_level INT,
    last_restock_date DATE,
    expiry_date DATE,
    storage_location VARCHAR(255),
    stock_status ENUM('NORMAL', 'LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRED', 'NEAR_EXPIRY') DEFAULT 'NORMAL',
    FOREIGN KEY (upload_id) REFERENCES EXCEL_UPLOADS(upload_id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX idx_excel_uploads_branch ON EXCEL_UPLOADS(branch_id, file_type, is_active);
CREATE INDEX idx_sales_analytics_upload ON SALES_ANALYTICS(upload_id);
CREATE INDEX idx_sales_analytics_date ON SALES_ANALYTICS(transaction_date);
CREATE INDEX idx_product_catalog_upload ON PRODUCT_CATALOG(upload_id);
CREATE INDEX idx_inventory_analytics_upload ON INVENTORY_ANALYTICS(upload_id);
CREATE INDEX idx_inventory_analytics_status ON INVENTORY_ANALYTICS(stock_status);
