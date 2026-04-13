from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from datetime import datetime, timedelta
from extensions import mysql

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/metrics/<int:branch_id>', methods=['GET'])
@jwt_required()
def get_dashboard_metrics(branch_id):
    cur = mysql.connection.cursor()
    try:
        # Low stock count (items with quantity <= reorder point)
        cur.execute("""
            SELECT COUNT(*) as low_stock_count
            FROM BRANCH_INVENTORY bi
            JOIN PRODUCTS p ON bi.product_id = p.product_id
            WHERE bi.branch_id = %s AND bi.quantity_on_hand <= p.reorder_point
        """, (branch_id,))
        low_stock_count = cur.fetchone()[0]

        # Near expiry count (items expiring within 30 days)
        cur.execute("""
            SELECT COUNT(*) as near_expiry_count
            FROM BRANCH_INVENTORY
            WHERE branch_id = %s
            AND expiry_date IS NOT NULL
            AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            AND expiry_date >= CURDATE()
        """, (branch_id,))
        near_expiry_count = cur.fetchone()[0]

        # Total item units
        cur.execute("""
            SELECT COALESCE(SUM(quantity_on_hand), 0) as total_units
            FROM BRANCH_INVENTORY
            WHERE branch_id = %s
        """, (branch_id,))
        total_units = cur.fetchone()[0]

        # Inventory value
        cur.execute("""
            SELECT COALESCE(SUM(bi.quantity_on_hand * p.price_regular), 0) as inventory_value
            FROM BRANCH_INVENTORY bi
            JOIN PRODUCTS p ON bi.product_id = p.product_id
            WHERE bi.branch_id = %s
        """, (branch_id,))
        inventory_value = float(cur.fetchone()[0])

        return jsonify({
            "lowStockCount": low_stock_count,
            "nearExpiryCount": near_expiry_count,
            "totalItemUnits": total_units,
            "inventoryValue": inventory_value
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()

@dashboard_bp.route('/low-stock/<int:branch_id>', methods=['GET'])
@jwt_required()
def get_low_stock_items(branch_id):
    cur = mysql.connection.cursor()
    try:
        cur.execute("""
            SELECT
                bi.inventory_id,
                p.product_name_official,
                bi.quantity_on_hand,
                p.reorder_point,
                CASE
                    WHEN bi.quantity_on_hand = 0 THEN 'Critical'
                    WHEN bi.quantity_on_hand <= p.reorder_point THEN 'Low'
                    ELSE 'Normal'
                END as status
            FROM BRANCH_INVENTORY bi
            JOIN PRODUCTS p ON bi.product_id = p.product_id
            WHERE bi.branch_id = %s AND bi.quantity_on_hand <= p.reorder_point
            ORDER BY bi.quantity_on_hand ASC
        """, (branch_id,))

        items = cur.fetchall()
        low_stock_items = []

        for item in items:
            low_stock_items.append({
                "inventoryId": item[0],
                "name": item[1],
                "quantity": item[2],
                "reorder": item[3],
                "status": item[4]
            })

        return jsonify(low_stock_items), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()

@dashboard_bp.route('/near-expiry/<int:branch_id>', methods=['GET'])
@jwt_required()
def get_near_expiry_items(branch_id):
    cur = mysql.connection.cursor()
    try:
        cur.execute("""
            SELECT
                bi.inventory_id,
                p.product_name_official,
                bi.expiry_date,
                DATEDIFF(bi.expiry_date, CURDATE()) as days_left
            FROM BRANCH_INVENTORY bi
            JOIN PRODUCTS p ON bi.product_id = p.product_id
            WHERE bi.branch_id = %s
            AND bi.expiry_date IS NOT NULL
            AND bi.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            AND bi.expiry_date >= CURDATE()
            ORDER BY bi.expiry_date ASC
        """, (branch_id,))

        items = cur.fetchall()
        near_expiry_items = []

        for item in items:
            near_expiry_items.append({
                "inventoryId": item[0],
                "name": item[1],
                "expiry": item[2].strftime('%Y-%m-%d') if item[2] else None,
                "daysLeft": item[3]
            })

        return jsonify(near_expiry_items), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()

@dashboard_bp.route('/sales-trend/<int:branch_id>', methods=['GET'])
@jwt_required()
def get_sales_trend(branch_id):
    period = request.args.get('period', 'week')  # week, month, year

    cur = mysql.connection.cursor()
    try:
        if period == 'week':
            # Daily sales for the current week
            cur.execute("""
                SELECT
                    DATE_FORMAT(sale_date, '%a') as day,
                    COALESCE(SUM(total_amount), 0) as sales
                FROM SALES_HEADERS
                WHERE branch_id = %s
                AND YEARWEEK(sale_date) = YEARWEEK(CURDATE())
                GROUP BY DATE(sale_date), DATE_FORMAT(sale_date, '%a')
                ORDER BY DATE(sale_date)
            """, (branch_id,))

        elif period == 'month':
            # Weekly sales for the current month
            cur.execute("""
                SELECT
                    CONCAT('W', WEEK(sale_date) - WEEK(DATE_SUB(sale_date, INTERVAL DAY(sale_date)-1 DAY)) + 1) as day,
                    COALESCE(SUM(total_amount), 0) as sales
                FROM SALES_HEADERS
                WHERE branch_id = %s
                AND MONTH(sale_date) = MONTH(CURDATE())
                AND YEAR(sale_date) = YEAR(CURDATE())
                GROUP BY WEEK(sale_date)
                ORDER BY WEEK(sale_date)
            """, (branch_id,))

        else:  # year
            # Monthly sales for the current year
            cur.execute("""
                SELECT
                    DATE_FORMAT(sale_date, '%b') as day,
                    COALESCE(SUM(total_amount), 0) as sales
                FROM SALES_HEADERS
                WHERE branch_id = %s
                AND YEAR(sale_date) = YEAR(CURDATE())
                GROUP BY MONTH(sale_date), DATE_FORMAT(sale_date, '%b')
                ORDER BY MONTH(sale_date)
            """, (branch_id,))

        sales_data = cur.fetchall()
        trend_data = []

        for item in sales_data:
            trend_data.append({
                "day": item[0],
                "sales": float(item[1])
            })

        return jsonify(trend_data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()

@dashboard_bp.route('/stock-distribution/<int:branch_id>', methods=['GET'])
@jwt_required()
def get_stock_distribution(branch_id):
    cur = mysql.connection.cursor()
    try:
        # Get stock levels by category
        cur.execute("""
            SELECT
                COALESCE(p.category_type, 'Uncategorized') as category,
                SUM(bi.quantity_on_hand) as total_quantity
            FROM BRANCH_INVENTORY bi
            LEFT JOIN PRODUCTS p ON bi.product_id = p.product_id
            WHERE bi.branch_id = %s
            GROUP BY p.category_type
            ORDER BY total_quantity DESC
        """, (branch_id,))

        categories = cur.fetchall()

        # Define colors for the pie chart
        colors = [
            "#0088FE", "#00C49F", "#FFBB28", "#FF8042",
            "#8884D8", "#82CA9D", "#FFC658", "#FF7C7C"
        ]

        distribution_data = []
        for i, category in enumerate(categories):
            distribution_data.append({
                "name": category[0],
                "value": category[1],
                "color": colors[i % len(colors)]
            })

        return jsonify(distribution_data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()