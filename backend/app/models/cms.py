import uuid
from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class CmsBanner(Base):
    __tablename__ = "cms_banners"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    subtitle = Column(String)
    minio_key = Column(String)
    is_visible = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class CmsStaticPage(Base):
    __tablename__ = "cms_static_pages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String, unique=True, nullable=False)  # 'terms', 'privacy', 'contact'
    content = Column(Text, nullable=False)


class CmsFeaturedProperty(Base):
    __tablename__ = "cms_featured_properties"

    property_id = Column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        primary_key=True,
    )
    sort_order = Column(Integer, default=0)
