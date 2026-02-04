const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer');

class ThermalPrintService {
    static async printBarcodeLabel(data) {
        const { sku, brandName, categoryName, modelNo, shopName, printerInterface } = data;

        try {
            const printer = new ThermalPrinter({
                type: PrinterTypes.EPSON,
                interface: printerInterface || 'tcp://192.168.1.100', // Default printer IP
                width: 32,
                characterSet: CharacterSet.PC852_LATIN2,
                removeSpecialCharacters: false,
                lineCharacter: "=",
            });

            // Check if printer is connected
            const isConnected = await printer.isPrinterConnected();
            if (!isConnected) {
                throw new Error('Printer is not connected');
            }

            // Center align and add product info
            printer.alignCenter();
            printer.setTextSize(0, 0);

            // Product details
            const productInfo = [brandName, categoryName, modelNo].filter(Boolean).join(" / ");
            if (productInfo) {
                printer.println(productInfo);
            }

            // Shop name
            printer.bold(true);
            printer.println(`SHOP: ${shopName}`);
            printer.bold(false);
            printer.newLine();

            // Print barcode
            if (sku) {
                printer.code128(sku);
            }

            printer.newLine();
            printer.cut();

            // Execute print
            await printer.execute();

            return { success: true, message: 'Label printed successfully' };
        } catch (error) {
            console.error('Thermal print error:', error);
            throw new Error(`Print failed: ${error.message}`);
        }
    }

    static async testConnection(printerInterface) {
        try {
            const printer = new ThermalPrinter({
                type: PrinterTypes.EPSON,
                interface: printerInterface,
                width: 32,
            });

            const isConnected = await printer.isPrinterConnected();
            return { connected: isConnected };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }

    static async printKOT(data) {
        const { invoiceNumber, tableNumber, guestNumber, date, items, specialNotes, businessName, printerInterface } = data;

        try {
            const printer = new ThermalPrinter({
                type: PrinterTypes.EPSON,
                interface: printerInterface || 'tcp://192.168.1.100',
                width: 32,
                characterSet: CharacterSet.PC852_LATIN2,
                removeSpecialCharacters: false,
                lineCharacter: "=",
            });

            const isConnected = await printer.isPrinterConnected();
            if (!isConnected) {
                throw new Error('Printer is not connected');
            }

            // Header
            printer.alignCenter();
            printer.bold(true);
            printer.println(businessName || 'Restaurant');
            printer.bold(false);
            printer.newLine();
            printer.bold(true);
            printer.println('KITCHEN ORDER TICKET');
            printer.bold(false);
            printer.newLine();
            printer.newLine();

            // Order Info
            printer.alignLeft();
            printer.println(`Table: ${tableNumber || 'N/A'} | Guests: ${guestNumber || 'N/A'}`);
            printer.println(`Date: ${new Date(date).toLocaleString()}`);
            printer.drawLine();

            // Items
            items.forEach((item, index) => {
                printer.println(`${index + 1}. ${item.quantity}x ${item.productName}`);
                if (item.details) {
                    printer.println(`   ${item.details}`);
                }
            });

            printer.drawLine();
            printer.alignCenter();
            printer.println(`Total Items: ${items.reduce((sum, item) => sum + item.quantity, 0)}`);

            // Special notes
            if (specialNotes && String(specialNotes).trim() !== '') {
                printer.newLine();
                printer.alignLeft();
                printer.bold(true);
                printer.println('SPECIAL INSTRUCTIONS:');
                printer.bold(false);
                printer.println(String(specialNotes));
            }

            printer.newLine();
            printer.newLine();
            printer.cut();

            await printer.execute();

            return { success: true, message: 'KOT printed successfully' };
        } catch (error) {
            console.error('KOT print error:', error);
            throw new Error(`KOT print failed: ${error.message}`);
        }
    }

    static async printInvoice(data) {
        const {
            invoiceNumber,
            tableNumber,
            guestNumber,
            date,
            items,
            summary,
            payment,
            customer,
            businessInfo,
            specialNotes,
            printerInterface
        } = data;

        try {
            const printer = new ThermalPrinter({
                type: PrinterTypes.EPSON,
                interface: printerInterface || 'tcp://192.168.1.100',
                width: 32,
                characterSet: CharacterSet.PC852_LATIN2,
                removeSpecialCharacters: false,
                lineCharacter: "=",
            });

            const isConnected = await printer.isPrinterConnected();
            if (!isConnected) {
                throw new Error('Printer is not connected');
            }

            // Helper for two-column layout
            const twoColumn = (left, right) => {
                const space = Math.max(32 - left.length - right.length, 1);
                return left + ' '.repeat(space) + right;
            };

            // Header
            printer.alignCenter();
            printer.bold(true);
            printer.println(businessInfo.name);
            printer.bold(false);
            printer.newLine();
            printer.println(businessInfo.address);
            printer.newLine();
            printer.println(`Tel: ${businessInfo.phone}`);
            printer.newLine();
            printer.println(new Date(date).toLocaleString());
            printer.newLine();
            printer.newLine();

            printer.bold(true);
            printer.println('INVOICE');
            printer.bold(false);
            printer.newLine();

            // Meta info
            printer.alignLeft();
            printer.println(`Invoice #: ${invoiceNumber}`);
            if (tableNumber) {
                printer.println(`Table: ${tableNumber}`);
            }
            if (guestNumber) {
                printer.println(`Guests: ${guestNumber}`);
            }
            printer.println(`Customer: ${customer.name}`);
            printer.println(`Phone: ${customer.phone}`);
            printer.drawLine();

            // Items
            items.forEach((item) => {
                const itemLine = `${item.quantity} x ${item.productName}`;
                const price = `${summary.currency || '฿'}${item.subtotal.toFixed(2)}`;
                printer.println(twoColumn(itemLine, price));
                if (item.details) {
                    printer.println(`  ${item.details}`);
                }
            });

            printer.drawLine();

            // Summary
            printer.println(twoColumn('Subtotal', `${summary.currency || '฿'}${summary.subtotal}`));
            printer.println(twoColumn(`Tax (${summary.taxRate})`, `${summary.currency || '฿'}${summary.tax}`));

            if (Number(summary.discount) > 0) {
                printer.println(twoColumn(`Discount (${summary.discountRate})`, `-${summary.currency || '฿'}${summary.discount}`));
            }

            printer.drawLine();
            printer.bold(true);
            printer.println(twoColumn('TOTAL', `${summary.currency || '฿'}${summary.total}`));
            printer.bold(false);
            printer.newLine();

            // Payment info
            const paymentMethod = payment.method === 'mobile_banking' ? 'Mobile Banking' : payment.method.toUpperCase();
            printer.println(twoColumn('Payment Method', paymentMethod));
            printer.println(twoColumn('Payment Status', payment.status));
            printer.println(twoColumn('Paid Amount', `${summary.currency || '฿'}${payment.paidAmount}`));

            if (payment.remainingAmount > 0) {
                printer.println(twoColumn('Remaining', `${summary.currency || '฿'}${payment.remainingAmount}`));
            }

            // Special notes
            if (specialNotes && String(specialNotes).trim() !== '') {
                printer.newLine();
                printer.alignLeft();
                printer.bold(true);
                printer.println('SPECIAL NOTES:');
                printer.bold(false);
                printer.println(String(specialNotes));
            }

            // Footer
            printer.newLine();
            printer.alignCenter();
            printer.println('Thank you for your business!');
            printer.newLine();
            printer.println(businessInfo.email);
            printer.newLine();
            printer.println(`Tax ID: ${businessInfo.taxId}`);
            printer.newLine();
            printer.newLine();

            printer.cut();

            await printer.execute();

            return { success: true, message: 'Invoice printed successfully' };
        } catch (error) {
            console.error('Invoice print error:', error);
            throw new Error(`Invoice print failed: ${error.message}`);
        }
    }
}

module.exports = ThermalPrintService;
