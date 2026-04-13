from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import json

analytics_bp = Blueprint('analytics', __name__, url_prefix='/analytics')

@analytics_bp.route('/upload', methods=['POST'])
# @jwt_required()  # Disabled for testing
def upload_excel_analytics():
    """Upload and process Excel analytics data"""
    try:
        # For testing, use mock claims instead of database
        claims = {'user_id': 1, 'branch_id': 1, 'role': 'manager'}
        user_id = claims.get('user_id')
        branch_id = claims.get('branch_id')

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        file_name = data.get('fileName')
        file_type = data.get('fileType')
        analytics_data = data.get('data')

        if not all([file_name, file_type, analytics_data]):
            return jsonify({'error': 'Missing required fields'}), 400

        # For testing purposes, skip database operations
        # In production, this would save to database
        print(f"Mock upload: {file_name} ({file_type}) for branch {branch_id}")

        return jsonify({
            'message': 'Analytics data uploaded successfully',
            'file_name': file_name,
            'file_type': file_type,
            'records_processed': len(analytics_data.get(file_type, []))
        }), 200

    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({'error': 'Failed to process upload'}), 500

@analytics_bp.route('/<file_type>/<int:branch_id>', methods=['GET'])
# @jwt_required()  # Disabled for testing
def get_analytics(file_type, branch_id):
    """Get analytics data for a specific type and branch"""
    try:
        # For testing, use mock claims
        claims = {'user_id': 1, 'branch_id': branch_id, 'role': 'manager'}
        user_branch_id = claims.get('branch_id')

        # Allow managers to access their own branch data, admins can access any
        if claims.get('role') != 'admin' and user_branch_id != branch_id:
            return jsonify({'error': 'Access denied'}), 403

        # Return enhanced mock data for testing
        if file_type == 'sales':
            mock_sales = [
                {
                    'id': 1,
                    'date': '2024-01-15',
                    'cashier': 'John Doe',
                    'description': 'Paracetamol 500mg',
                    'department': 'Pain Relief',
                    'category': 'Analgesics',
                    'grossSales': 150.00,
                    'costPrice': 45.00,
                    'netProfit': 105.00,
                    'grossMargin': 70.0,  # (profit/gross) * 100
                    'netMargin': 70.0,    # (profit/gross) * 100
                    'profitPerUnit': 35.00,
                    'qtySold': 3,
                    'discountAmt': 0.00,
                    'discountPercent': 0.0,
                    'time': '14:30:00',
                    'invoiceNo': 'INV001',
                    'transactionValue': 150.00,
                    'itemsPerTransaction': 3,
                    'fileName': 'sales_report.xlsx',
                    'uploadDate': '2024-01-15'
                },
                {
                    'id': 2,
                    'date': '2024-01-15',
                    'cashier': 'Jane Smith',
                    'description': 'Amoxicillin 250mg',
                    'department': 'Antibiotics',
                    'category': 'Infection Control',
                    'grossSales': 200.00,
                    'costPrice': 80.00,
                    'netProfit': 120.00,
                    'grossMargin': 60.0,
                    'netMargin': 60.0,
                    'profitPerUnit': 40.00,
                    'qtySold': 3,
                    'discountAmt': 20.00,
                    'discountPercent': 10.0,
                    'time': '15:45:00',
                    'invoiceNo': 'INV002',
                    'transactionValue': 200.00,
                    'itemsPerTransaction': 1,
                    'fileName': 'sales_report.xlsx',
                    'uploadDate': '2024-01-15'
                },
                {
                    'id': 3,
                    'date': '2024-01-16',
                    'cashier': 'John Doe',
                    'description': 'Vitamin C 1000mg',
                    'department': 'Vitamins',
                    'category': 'Supplements',
                    'grossSales': 300.00,
                    'costPrice': 120.00,
                    'netProfit': 180.00,
                    'grossMargin': 60.0,
                    'netMargin': 60.0,
                    'profitPerUnit': 45.00,
                    'qtySold': 4,
                    'discountAmt': 0.00,
                    'discountPercent': 0.0,
                    'time': '10:15:00',
                    'invoiceNo': 'INV003',
                    'transactionValue': 300.00,
                    'itemsPerTransaction': 4,
                    'fileName': 'sales_report.xlsx',
                    'uploadDate': '2024-01-15'
                }
            ]
            return jsonify({'sales': mock_sales})

        elif file_type == 'products':
            mock_products = [
                {
                    'id': 1,
                    'itemCode': 'PARA500',
                    'description': 'Paracetamol 500mg',
                    'department': 'Pain Relief',
                    'category': 'Analgesics',
                    'sellingPrice': 50.00,
                    'costPrice': 15.00,
                    'stockLevel': 150,
                    'reorderLevel': 30,
                    'supplier': 'ABC Pharma',
                    'stockTurnoverRate': 12.5,  # times per year
                    'daysOfInventory': 28.8,    # days
                    'suggestedReorderQty': 45,
                    'isLowStock': False,
                    'isNearExpiry': False,
                    'daysToExpiry': 120,
                    'fileName': 'product_catalog.xlsx',
                    'uploadDate': '2024-01-15'
                },
                {
                    'id': 2,
                    'itemCode': 'AMOX250',
                    'description': 'Amoxicillin 250mg',
                    'department': 'Antibiotics',
                    'category': 'Infection Control',
                    'sellingPrice': 75.00,
                    'costPrice': 25.00,
                    'stockLevel': 25,
                    'reorderLevel': 20,
                    'supplier': 'MediCorp',
                    'stockTurnoverRate': 8.3,
                    'daysOfInventory': 43.4,
                    'suggestedReorderQty': 35,
                    'isLowStock': True,
                    'isNearExpiry': False,
                    'daysToExpiry': 90,
                    'fileName': 'product_catalog.xlsx',
                    'uploadDate': '2024-01-15'
                },
                {
                    'id': 3,
                    'itemCode': 'VITC1000',
                    'description': 'Vitamin C 1000mg',
                    'department': 'Vitamins',
                    'category': 'Supplements',
                    'sellingPrice': 85.00,
                    'costPrice': 30.00,
                    'stockLevel': 80,
                    'reorderLevel': 25,
                    'supplier': 'NutriHealth',
                    'stockTurnoverRate': 15.2,
                    'daysOfInventory': 23.7,
                    'suggestedReorderQty': 50,
                    'isLowStock': False,
                    'isNearExpiry': True,
                    'daysToExpiry': 15,
                    'fileName': 'product_catalog.xlsx',
                    'uploadDate': '2024-01-15'
                }
            ]
            return jsonify({'products': mock_products})

        elif file_type == 'inventory':
            mock_inventory = [
                {
                    'id': 1,
                    'itemCode': 'PARA500',
                    'description': 'Paracetamol 500mg',
                    'currentStock': 150,
                    'reorderLevel': 30,
                    'lastRestockDate': '2024-01-10',
                    'expiryDate': '2024-06-15',
                    'location': 'Shelf A1',
                    'stockStatus': 'NORMAL',
                    'stockTurnoverRate': 12.5,
                    'daysOfInventory': 28.8,
                    'suggestedReorderQty': 45,
                    'isLowStock': False,
                    'isNearExpiry': False,
                    'daysToExpiry': 120,
                    'fileName': 'inventory_report.xlsx',
                    'uploadDate': '2024-01-15'
                },
                {
                    'id': 2,
                    'itemCode': 'AMOX250',
                    'description': 'Amoxicillin 250mg',
                    'currentStock': 25,
                    'reorderLevel': 20,
                    'lastRestockDate': '2024-01-08',
                    'expiryDate': '2024-04-15',
                    'location': 'Shelf B2',
                    'stockStatus': 'LOW_STOCK',
                    'stockTurnoverRate': 8.3,
                    'daysOfInventory': 43.4,
                    'suggestedReorderQty': 35,
                    'isLowStock': True,
                    'isNearExpiry': True,
                    'daysToExpiry': 15,
                    'fileName': 'inventory_report.xlsx',
                    'uploadDate': '2024-01-15'
                }
            ]
            return jsonify({'inventory': mock_inventory})

        return jsonify({'error': 'Invalid file type'}), 400

    except Exception as e:
        print(f"Analytics fetch error: {str(e)}")
        return jsonify({'error': 'Failed to fetch analytics data'}), 500

@analytics_bp.route('/summary/<int:branch_id>', methods=['GET'])
# @jwt_required()  # Disabled for testing
def get_analytics_summary(branch_id):
    """Get summary statistics for all analytics types"""
    try:
        # For testing, use mock claims
        claims = {'user_id': 1, 'branch_id': branch_id, 'role': 'manager'}
        user_branch_id = claims.get('branch_id')

        if claims.get('role') != 'admin' and user_branch_id != branch_id:
            return jsonify({'error': 'Access denied'}), 403

        # Return enhanced mock summary data for testing
        mock_summary = {
            'sales': {
                'totalSales': 650.00,
                'totalProfit': 405.00,
                'totalItemsSold': 10,
                'totalTransactions': 3,
                'latestDate': '2024-01-16',
                'avgTransactionValue': 216.67,
                'avgItemsPerTransaction': 3.33,
                'totalDiscountAmount': 20.00,
                'totalDiscountPercent': 3.08,
                'avgGrossMargin': 63.33,
                'avgNetMargin': 63.33,
                'topProfitableItems': [
                    {'name': 'Vitamin C 1000mg', 'profit': 180.00, 'margin': 60.0},
                    {'name': 'Amoxicillin 250mg', 'profit': 120.00, 'margin': 60.0},
                    {'name': 'Paracetamol 500mg', 'profit': 105.00, 'margin': 70.0}
                ],
                'departmentBreakdown': {
                    'Pain Relief': {'sales': 150.00, 'profit': 105.00, 'percentage': 23.08},
                    'Antibiotics': {'sales': 200.00, 'profit': 120.00, 'percentage': 30.77},
                    'Vitamins': {'sales': 300.00, 'profit': 180.00, 'percentage': 46.15}
                },
                'cashierPerformance': {
                    'John Doe': {
                        'totalSales': 450.00,
                        'totalTransactions': 2,
                        'avgTransactionValue': 225.00,
                        'avgItemsPerTransaction': 3.5,
                        'totalDiscount': 0.00
                    },
                    'Jane Smith': {
                        'totalSales': 200.00,
                        'totalTransactions': 1,
                        'avgTransactionValue': 200.00,
                        'avgItemsPerTransaction': 1.0,
                        'totalDiscount': 20.00
                    }
                },
                'trends': {
                    'daily': [
                        {'date': '2024-01-15', 'sales': 350.00, 'profit': 225.00},
                        {'date': '2024-01-16', 'sales': 300.00, 'profit': 180.00}
                    ],
                    'weeklyGrowth': 15.2,
                    'monthlyGrowth': 8.5
                }
            },
            'products': {
                'totalProducts': 3,
                'totalCategories': 3,
                'avgPrice': 70.00,
                'totalSuppliers': 3,
                'avgStockTurnover': 12.0,
                'avgDaysOfInventory': 32.0,
                'lowStockItems': 1,
                'nearExpiryItems': 1,
                'totalStockValue': 15750.00
            },
            'inventory': {
                'totalItems': 2,
                'totalStock': 175,
                'lowStockCount': 1,
                'nearExpiryCount': 1,
                'outOfStockCount': 0,
                'avgStockTurnover': 10.4,
                'avgDaysOfInventory': 36.1,
                'totalStockValue': 15750.00
            }
        }

        return jsonify(mock_summary), 200

    except Exception as e:
        print(f"Analytics summary error: {str(e)}")
        return jsonify({'error': 'Failed to fetch analytics summary'}), 500
