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
                printer
                    .font('a')
                    .align('ct')
                    .style('bu')
                    .size(1, 1)
                    .text('ESCPOS SERVER TEST')
                    .text('--------------------------------')
                    .text('The quick brown fox jumps over')
                    .text('the lazy dog.')
                    .text('--------------------------------')
                    .barcode('1234567', 'EAN8')
                    .feed(2)
                    .cut()
                    .close();

                resolve("Print command sent successfully");
            } catch (err) {
                reject(err);
            }
        });
    });
};

module.exports = { printTest };
