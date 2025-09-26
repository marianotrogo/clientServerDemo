import PDFDocument from 'pdfkit'
import dayjs from 'dayjs'

export const buildTicket = ({business, order})=>{
    const doc = new PDFDocument({size: [226.77,600], margin:10})
    doc.fontSize(10).text(business.name, {align: 'center'})
    doc.text(business.address, {align: 'center'})
    doc.text(`Tel: ${business.tel}`, {align: 'center'})
    doc.moveDown()
    doc.text(`Fecha: ${dayjs(order.createdAt).format('DD/MM/YYYY HH:mm')}`)
    doc.text(`Comprobante: ${order.number}`)
    doc.text(`Mesa/Cliente: ${order.table || order.customerName || '-'}`)
    doc.moveDown()
    doc.text('Detalle:')
    order.items.forEach(it=>{
        doc.text(`${it.qty} x ${it.name}  $${it.price.toFixed(2)}`)
    })
    doc.moveDown()
    doc.text(`Subtotal: $${order.subtotal.toFixed(2)}`)
    if(order.discount) doc.text(`Descuento: -$${order.discount.toFixed(2)}`)
    if(order.surcharge) doc.text(`Recargo: $${order.surcharge.toFixed(2)}`)
    doc.text(`TOTAL: $${order.total.toFixed(2)}`)
    doc.moveDown()
    if(business.footer) doc.text(business.footer, {align:'center'})
    doc.end()
    return doc
}