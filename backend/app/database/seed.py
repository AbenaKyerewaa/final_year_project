import sys
import os

# Ensure the parent directory is in sys.path so we can run the script directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.database import base
from app.database.session import SessionLocal, engine
from app.auth.models import User
from app.businesses.models import Business
from app.products.models import Product
from app.services.models import Service
from app.faqs.models import FAQ

from app.auth.security import hash_password

def seed_db():
    # Recreate tables if they don't exist
    base.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if we already have users to prevent double seeding
        existing_user = db.query(User).filter(User.email == "michy@easybiz.com").first()
        if existing_user:
            print("Database already seeded with sample user!")
            return

        print("Seeding database...")
        
        # 1. Create User
        user = User(
            full_name="Michy Mensah",
            email="michy@easybiz.com",
            password_hash=hash_password("password123"),
            role="business_owner"
        )
        db.add(user)
        db.flush() # Populate user.id

        # 1b. Create Abena User
        abena_user = User(
            full_name="Abena EasyBiz",
            email="abena@gmail.com",
            password_hash=hash_password("password123"),
            role="business_owner"
        )
        db.add(abena_user)
        db.flush()

        # 2. Create Business
        business = Business(
            owner_id=user.id,
            business_name="Michy's Tech Hub",
            category="Electronics Shop",
            location="Adum, Kumasi, Ghana",
            phone="+233 24 123 4567",
            whatsapp_number="+233 24 123 4567",
            opening_hours="Monday - Saturday: 8:00 AM - 6:00 PM",
            payment_methods="Mobile Money (MTN, Telecel), Cash, Bank Transfer",
            delivery_options="Delivery in Kumasi via Errand Services (GHS 15-30), Nationwide shipping via VIP Bus",
            description="A modern shop in Kumasi retailing quality laptops, phone accessories, and providing expert technical services."
        )
        db.add(business)
        db.flush() # Populate business.id

        # 3. Create Products
        products = [
            Product(
                business_id=business.id,
                name="HP EliteBook 840 G6",
                category="Laptops",
                description="Core i5, 8GB RAM, 256GB SSD, 14 inch display, Grade A clean.",
                price=4200.00,
                currency="GHS",
                quantity=5,
                availability_status="available",
                warranty="3 months",
                image_url=None
            ),
            Product(
                business_id=business.id,
                name="Dell Latitude 5400",
                category="Laptops",
                description="Core i5, 8GB RAM, 256GB SSD, robust business laptop.",
                price=3800.00,
                currency="GHS",
                quantity=0,
                availability_status="out_of_stock",
                warranty="3 months",
                image_url=None
            ),
            Product(
                business_id=business.id,
                name="Universal Laptop Charger",
                category="Accessories",
                description="90W multi-tip laptop charger adapter.",
                price=150.00,
                currency="GHS",
                quantity=15,
                availability_status="available",
                warranty="1 month",
                image_url=None
            )
        ]
        db.add_all(products)

        # 4. Create Services
        services = [
            Service(
                business_id=business.id,
                name="Laptop Repair & Servicing",
                description="Dust cleaning, thermal paste replacement, hardware repair.",
                price=250.00,
                currency="GHS",
                duration=120,
                availability_status="available"
            ),
            Service(
                business_id=business.id,
                name="OS and Software Installation",
                description="Windows installation, software updates, drivers, office suite setup.",
                price=100.00,
                currency="GHS",
                duration=60,
                availability_status="available"
            )
        ]
        db.add_all(services)

        # 5. Create FAQs
        faqs = [
            FAQ(
                business_id=business.id,
                question="Where is your shop located?",
                answer="We are located at Adum, Kumasi, near the old post office. You can call us on +233 24 123 4567 for directions."
            ),
            FAQ(
                business_id=business.id,
                question="Do you accept Mobile Money (MoMo)?",
                answer="Yes, we accept MoMo payments on MTN and Telecel. We also accept Cash and Bank transfers."
            ),
            FAQ(
                business_id=business.id,
                question="Do you deliver to Accra?",
                answer="Yes, we ship nationwide! For Accra and other regions, we ship via VIP Bus or OA Travel. Delivery fee is paid by the customer."
            )
        ]
        db.add_all(faqs)
        db.flush()

        # --- 6. Create MelTech Computers ---
        meltech = Business(
            owner_id=user.id,
            business_name="MelTech Computers",
            category="Retail & Electronics",
            location="Ring Road East, Accra, Ghana",
            phone="+233 30 222 3344",
            whatsapp_number="+233 24 555 1122",
            opening_hours="Monday - Friday: 9:00 AM - 5:30 PM, Saturday: 9:00 AM - 2:00 PM",
            payment_methods="Mobile Money, Visa/Mastercard, Cash",
            delivery_options="Courier service within Accra (GHS 20-40), DHL for other regions",
            description="A premium computer shop in Accra specializing in new and Grade-A clean refurbished laptops, accessories, and expert computer repair services."
        )
        db.add(meltech)
        db.flush()

        meltech_products = [
            Product(
                business_id=meltech.id,
                name="Lenovo ThinkPad T14 G2",
                category="Laptops",
                description="Core i7, 16GB RAM, 512GB SSD, Windows 11, excellent performance.",
                price=6500.00,
                currency="GHS",
                quantity=8,
                availability_status="available",
                warranty="6 months",
            ),
            Product(
                business_id=meltech.id,
                name="HP ProBook 450 G8",
                category="Laptops",
                description="Core i5, 8GB RAM, 256GB SSD, 15.6 inch screen, brand new box.",
                price=5200.00,
                currency="GHS",
                quantity=4,
                availability_status="available",
                warranty="1 year",
            )
        ]
        db.add_all(meltech_products)

        meltech_services = [
            Service(
                business_id=meltech.id,
                name="Laptop Screen Replacement",
                description="Professional screen replacement for major brands like HP, Dell, Lenovo.",
                price=450.00,
                currency="GHS",
                duration=90,
                availability_status="available"
            )
        ]
        db.add_all(meltech_services)

        meltech_faqs = [
            FAQ(
                business_id=meltech.id,
                question="Do you sell new or used laptops?",
                answer="We sell both brand new in box and Grade A clean refurbished laptops. Refurbished laptops undergo rigorous quality checks."
            ),
            FAQ(
                business_id=meltech.id,
                question="What is your warranty policy?",
                answer="We provide a 1-year warranty on brand new laptops and a 6-month warranty on refurbished laptops. Accessories have 1 month warranty."
            )
        ]
        db.add_all(meltech_faqs)

        # --- 7. Create Grace Academy ---
        grace = Business(
            owner_id=user.id,
            business_name="Grace Academy",
            category="Education & School",
            location="East Legon, Accra, Ghana",
            phone="+233 30 255 6677",
            whatsapp_number="+233 24 555 3344",
            opening_hours="Monday - Friday: 7:30 AM - 4:30 PM",
            payment_methods="Bank Draft, Direct Bank Transfer, Mobile Money School Pay",
            delivery_options="No delivery. Textbooks and uniforms collected at administration office.",
            description="A prestigious basic school in East Legon providing quality pre-school, primary, and junior high school education with a focus on holistic student development."
        )
        db.add(grace)
        db.flush()

        grace_products = [
            Product(
                business_id=grace.id,
                name="Official School Uniform Set",
                category="Uniforms",
                description="Includes shirt/blouse and shorts/skirt. Available in all school sizes.",
                price=220.00,
                currency="GHS",
                quantity=100,
                availability_status="available",
                warranty="None",
            ),
            Product(
                business_id=grace.id,
                name="Grade 1 English & Science Textbook Pack",
                category="Books",
                description="Approved textbooks for Grade 1 pupils.",
                price=180.00,
                currency="GHS",
                quantity=50,
                availability_status="available",
                warranty="None",
            )
        ]
        db.add_all(grace_products)

        grace_services = [
            Service(
                business_id=grace.id,
                name="After-School Care",
                description="Supervised homework support and activities for pupils from 3:00 PM to 6:00 PM.",
                price=500.00,
                currency="GHS",
                duration=180,
                availability_status="available"
            ),
            Service(
                business_id=grace.id,
                name="New Admission Registration",
                description="Processing fee for new pupils seeking admission.",
                price=150.00,
                currency="GHS",
                duration=30,
                availability_status="available"
            )
        ]
        db.add_all(grace_services)

        grace_faqs = [
            FAQ(
                business_id=grace.id,
                question="What is the tuition fee per term?",
                answer="Tuition fees vary depending on the grade levels (Pre-school, Primary, JHS). Please contact our admissions office at admissions@graceacademy.edu.gh for the detailed fee schedule."
            ),
            FAQ(
                business_id=grace.id,
                question="Do you offer school bus services?",
                answer="Yes, we offer reliable school bus pickups and drop-offs for students residing within East Legon, Madina, and Adenta areas."
            )
        ]
        db.add_all(grace_faqs)

        # --- 8. Create Akwaaba Restaurant ---
        akwaaba = Business(
            owner_id=abena_user.id,
            business_name="Akwaaba Restaurant",
            category="Food & Beverage",
            location="Osu, Accra, Ghana",
            phone="+233 30 299 8877",
            whatsapp_number="+233 24 555 5566",
            opening_hours="Monday - Sunday: 11:00 AM - 10:00 PM",
            payment_methods="Cash, Mobile Money (MTN, Telecel), Visa/Mastercard",
            delivery_options="Local delivery in Osu (GHS 10-15), Outer Accra delivery via Bolt Food/Glovo",
            description="A popular dining restaurant in Osu serving delicious, authentic Ghanaian local dishes and fresh tropical drinks in a clean, friendly environment."
        )
        db.add(akwaaba)
        db.flush()

        akwaaba_products = [
            Product(
                business_id=akwaaba.id,
                name="Jollof Rice with Grilled Chicken",
                category="Meals",
                description="Fragrant spiced jollof rice served with seasoned grilled chicken and shito.",
                price=65.00,
                currency="GHS",
                quantity=200,
                availability_status="available",
                warranty="None",
            ),
            Product(
                business_id=akwaaba.id,
                name="Fufu with Goat Light Soup",
                category="Meals",
                description="Freshly pounded cassava and plantain fufu served with rich goat meat light soup.",
                price=75.00,
                currency="GHS",
                quantity=150,
                availability_status="available",
                warranty="None",
            ),
            Product(
                business_id=akwaaba.id,
                name="Kelewele (Spicy Fried Plantain)",
                category="Sides",
                description="Cubed plantain marinated in ginger, pepper, and local spices, deep fried.",
                price=25.00,
                currency="GHS",
                quantity=500,
                availability_status="available",
                warranty="None",
            )
        ]
        db.add_all(akwaaba_products)

        akwaaba_services = [
            Service(
                business_id=akwaaba.id,
                name="Event Catering Service",
                description="Catering package per guest for corporate lunches, weddings, and private parties.",
                price=120.00,
                currency="GHS",
                duration=60,
                availability_status="available"
            )
        ]
        db.add_all(akwaaba_services)

        akwaaba_faqs = [
            FAQ(
                business_id=akwaaba.id,
                question="What are your opening hours?",
                answer="We are open Monday to Sunday from 11:00 AM to 10:00 PM for dine-in, takeout, and delivery."
            ),
            FAQ(
                business_id=akwaaba.id,
                question="Do you have vegetarian options?",
                answer="Yes! We serve vegetarian Jollof rice, plantain sides, and traditional Banku with vegetarian Okro soup (prepared without fish or meat)."
            )
        ]
        db.add_all(akwaaba_faqs)

        # --- 9. Create MelTech Pharmacy ---
        pharmacy = Business(
            owner_id=abena_user.id,
            business_name="MelTech Pharmacy",
            category="Pharmacy",
            location="Neighborhood clinic & dispensary in Accra",
            phone="+233 24 555 6677",
            whatsapp_number="+233 24 555 6677",
            opening_hours="Daily: 7:00 AM - 9:00 PM",
            payment_methods="Mobile Money, Cash, Bank Transfer",
            delivery_options="Delivery within Accra via dispatch riders (orders before 8:00 PM)",
            description="A neighborhood pharmacy and clinic dispensary in Accra providing quality medications and healthcare products."
        )
        db.add(pharmacy)
        db.flush()

        pharmacy_products = [
            Product(
                business_id=pharmacy.id,
                name="Paracetamol Tablets",
                category="Medication",
                description="Pack of 10 generic paracetamol tablets for pain relief and fever.",
                price=5.00,
                currency="GHS",
                quantity=100,
                availability_status="available",
                warranty="None",
            ),
            Product(
                business_id=pharmacy.id,
                name="Amoxicillin Capsules",
                category="Prescription",
                description="500mg Amoxicillin antibiotic capsules. Requires a valid doctor's prescription.",
                price=15.00,
                currency="GHS",
                quantity=50,
                availability_status="available",
                warranty="None",
            ),
            Product(
                business_id=pharmacy.id,
                name="Pediatric Cough Syrup",
                category="Medication",
                description="Cough syrup for children, relief of dry and tickly coughs. 100ml bottle.",
                price=35.00,
                currency="GHS",
                quantity=25,
                availability_status="available",
                warranty="None",
            )
        ]
        db.add_all(pharmacy_products)

        pharmacy_services = [
            Service(
                business_id=pharmacy.id,
                name="Pharmacist Consultation",
                description="Consultation check with the on-duty pharmacist for blood pressure, blood sugar, and medication advice.",
                price=50.00,
                currency="GHS",
                duration=15,
                availability_status="available"
            )
        ]
        db.add_all(pharmacy_services)

        pharmacy_faqs = [
            FAQ(
                business_id=pharmacy.id,
                question="Do you sell Paracetamol or Amoxicillin?",
                answer="We have Paracetamol (GHS 5.00 per pack) in stock. For Amoxicillin, it is available but requires a valid prescription. Note: I can only verify inventory. For medical advice, please consult our on-duty pharmacist."
            ),
            FAQ(
                business_id=pharmacy.id,
                question="Do you deliver medicines at night?",
                answer="We are open daily from 7:00 AM to 9:00 PM. We deliver within Accra via dispatch riders for orders placed before 8:00 PM. We do not offer overnight delivery."
            ),
            FAQ(
                business_id=pharmacy.id,
                question="Do you open on weekends?",
                answer="Yes, we are open daily from 7:00 AM to 9:00 PM, including Saturdays and Sundays."
            )
        ]
        db.add_all(pharmacy_faqs)

        db.commit()
        print("Database successfully seeded with all sample businesses (Michy's Tech Hub, MelTech, Grace Academy, Akwaaba Restaurant, MelTech Pharmacy)!")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
