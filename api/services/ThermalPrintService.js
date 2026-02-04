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
}

module.exports = ThermalPrintService;
