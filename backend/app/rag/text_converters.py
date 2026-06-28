# Helper serializers to format database entities into standardized textual formats for embedding

def convert_business_to_text(business) -> str:
    """Formats core SME profile details into a single text document."""
    lines = [
        f"Business Name: {business.business_name}",
        f"Category: {business.category}",
        f"Location: {business.location}",
        f"Phone Contact: {business.phone}"
    ]
    if business.whatsapp_number:
        lines.append(f"WhatsApp Contact: {business.whatsapp_number}")
    if business.opening_hours:
        lines.append(f"Opening Hours: {business.opening_hours}")
    if business.payment_methods:
        lines.append(f"Accepted Payment Methods: {business.payment_methods}")
    if business.delivery_options:
        lines.append(f"Delivery Options: {business.delivery_options}")
    if business.description:
        lines.append(f"About Business / Description: {business.description}")
        
    return "\n".join(lines)


def convert_product_to_text(product) -> str:
    """Formats product catalog details using a clean structured template."""
    lines = [
        f"Product: {product.name}.",
        f"Category: {product.category if product.category else 'General'}."
    ]
    
    # Format price neatly
    price_val = f"{product.price:,.2f}" if isinstance(product.price, (int, float)) or hasattr(product.price, '__float__') else str(product.price)
    currency_val = product.currency or "GHS"
    lines.append(f"Price: {currency_val} {price_val}.")
    
    lines.append(f"Availability: {product.availability_status.capitalize() if product.availability_status else 'Available'}.")
    lines.append(f"Quantity in Stock: {product.quantity if product.quantity is not None else 0}.")
    
    if product.warranty:
        lines.append(f"Warranty: {product.warranty}.")
    if product.description:
        lines.append(f"Description: {product.description}.")
        
    return "\n".join(lines)


def convert_service_to_text(service) -> str:
    """Formats service offering details using a structured template."""
    lines = [
        f"Service: {service.name}."
    ]
    if service.description:
        lines.append(f"Description: {service.description}.")
        
    price_val = f"{service.price:,.2f}" if isinstance(service.price, (int, float)) or hasattr(service.price, '__float__') else str(service.price)
    currency_val = service.currency or "GHS"
    lines.append(f"Price: {currency_val} {price_val}.")
    
    unit = service.duration_unit if hasattr(service, 'duration_unit') and service.duration_unit else "minutes"
    lines.append(f"Duration: {service.duration if service.duration else 0} {unit}.")
    lines.append(f"Availability: {service.availability_status.capitalize() if service.availability_status else 'Available'}.")
    
    return "\n".join(lines)


def convert_faq_to_text(faq) -> str:
    """Formats FAQ QA items into a simple readable prompt block."""
    return f"Question: {faq.question}\nAnswer: {faq.answer}"
