from app.database.base_class import Base

# Import all models here so that Base.metadata has them registered for Alembic
# When Alembic imports Base, it gets references to all registered tables.
from app.auth.models import User
from app.businesses.models import Business
from app.products.models import Product
from app.services.models import Service
from app.faqs.models import FAQ
from app.documents.models import Document
from app.chat.models import ChatSession, ChatMessage, Escalation
