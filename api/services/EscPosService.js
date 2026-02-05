const escpos = require('escpos');

// Try to load adapters
let USBAdapter;
try {
    USBAdapter = require('escpos-usb');
    escpos.USB = USBAdapter;
} catch (e) {
    console.warn('escpos-usb not found. USB printing will fail.');
}

// You can add other adapters here if needed
// try { escpos.Network = require('escpos-network'); } catch(e) {}

const printTest = async (printerType = 'usb') => {
    return new Promise((resolve, reject) => {
        let device;
        if (printerType === 'usb') {
            if (!USBAdapter) {
                return reject(new Error("USB Adapter (escpos-usb) is not installed."));
            }
            try {
                // Auto-find USB device (vid/pid can be passed if known)
                device = new escpos.USB();
            } catch (err) {
                return reject(new Error("Could not find or initialize USB printer: " + err.message));
            }
        } else if (printerType === 'network') {
            // device = new escpos.Network('localhost');
            return reject(new Error("Network printing is not yet configured."));
        } else {
            return reject(new Error(`Unsupported printer type: ${printerType}`));
        }

        const options = { encoding: "GB18030" /* default */ };
        const printer = new escpos.Printer(device, options);

        device.open(function (error) {
            if (error) {
                return reject(new Error("Printer open error: " + error));
            }

            try {
                // Helper for lines
                const solidLine = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
                const dashedLine = '------------------------------------------------';

                printer
                    .font('a')
                    .align('ct')

                    // Header
                    .size(2, 2)
                    .style('b')
                    .text('FG STORE 01')
                    .size(1, 1)
                    .style('normal')
                    .text('Patong')
                    .text('Tel: +66637475569')
                    .style('b')
                    .text(solidLine)

                    // Title
                    .feed(1)
                    .size(2, 2)
                    .style('b')
                    .text('INVOICE')
                    .size(1, 1) // Reset size
                    .style('normal')
                    .text('Invoice #: INV-00000005')
                    .text('Date: 2/5/2026, 11:27:12 PM')
                    .feed(1)

                    // Customer Info (Left Aligned)
                    .align('lt')
                    .text('Guests: 1')
                    .text('Customer: Walk-in Customer')
                    .text('Phone: N/A')
                    .align('ct')
                    .style('b')
                    .text(solidLine)
                    .style('normal')

                    // Items Header
                    .tableCustom([
                        { text: 'QTY', align: 'LEFT', width: 0.15, style: 'B' },
                        { text: 'ITEM', align: 'LEFT', width: 0.55, style: 'B' },
                        { text: 'TOTAL', align: 'RIGHT', width: 0.30, style: 'B' }
                    ])
                    .align('ct')
                    .text(solidLine)
                    .align('lt');

                // Item 1
                printer.tableCustom([
                    { text: '1', align: 'LEFT', width: 0.15 },
                    { text: 'AUDEMARS PIGUET (AP)', align: 'LEFT', width: 0.55 },
                    { text: 'B3,000.00', align: 'RIGHT', width: 0.30 }
                ]);

                // Item Description (Indented manually or via empty col)
                printer.text('      ROYAL OAK,');
                printer.text('      CHRONOGRAPH, FULL');
                printer.text('      YELLOW GOLD, BLUE FACE');
                printer.text('      GOLD - NORMAL');

                printer.align('ct').style('b').text(solidLine).style('normal').align('lt');

                // Totals
                // Using tableCustom for alignment of totals
                printer.tableCustom([
                    { text: '', align: 'LEFT', width: 0.40 },
                    { text: 'Subtotal:', align: 'LEFT', width: 0.30 },
                    { text: 'B3,000.00', align: 'RIGHT', width: 0.30 }
                ]);
                printer.tableCustom([
                    { text: '', align: 'LEFT', width: 0.40 },
                    { text: 'Tax (0.00%):', align: 'LEFT', width: 0.30 },
                    { text: 'B0.00', align: 'RIGHT', width: 0.30 }
                ]);

                printer.align('ct').style('b').text(solidLine).align('lt');

                // Grand Total
                printer.size(1, 1).style('b');
                printer.tableCustom([
                    { text: 'GRAND TOTAL:', align: 'LEFT', width: 0.50, style: 'B' }, // widened for "GRAND TOTAL:"
                    { text: 'B3,000.00', align: 'RIGHT', width: 0.50, style: 'B' }
                ]);

                printer.size(1, 1).style('normal');
                printer.align('ct').style('b').text(solidLine).align('lt');

                // Payment Info
                printer.tableCustom([
                    { text: 'Payment Method:', align: 'LEFT', width: 0.50 },
                    { text: 'CASH', align: 'RIGHT', width: 0.50 }
                ]);
                printer.tableCustom([
                    { text: 'Payment Status:', align: 'LEFT', width: 0.50 },
                    { text: 'completed', align: 'RIGHT', width: 0.50 }
                ]);
                printer.tableCustom([
                    { text: 'Paid Amount:', align: 'LEFT', width: 0.50 },
                    { text: 'B3,000.00', align: 'RIGHT', width: 0.50, style: 'B' } // Green usually not supported on thermal, just bold
                ]);

                printer.align('ct').text(dashedLine);

                // Footer
                printer.feed(1);
                printer.style('b').text('Thank you for your business!');
                printer.style('normal');
                printer.text('fgstore01@gmail.com');
                printer.text('Tax ID: 123456');

                printer.feed(3);
                printer.cut();
                printer.close();

                resolve("Print command sent successfully");
            } catch (err) {
                reject(err);
            }
        });
    });
};

module.exports = { printTest };
