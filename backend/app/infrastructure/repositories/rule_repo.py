"""Tortoise implementation of RuleRepository."""

from backend.app.domain.entities import (
    DEFAULT_BLEND_WEIGHTS,
    BlendWeights,
    RecommendationRule,
)
from backend.app.infrastructure.db.tortoise_models import (
    BlendWeights as BlendWeightsModel,
)
from backend.app.infrastructure.db.tortoise_models import (
    RecommendationRule as RecommendationRuleModel,
)


class TortoiseRuleRepository:
    async def list_all(self) -> list[RecommendationRule]:
        models = await RecommendationRuleModel.all()
        return [self._to_entity(model) for model in models]

    async def create(self, rule: RecommendationRule) -> RecommendationRule:
        model = await RecommendationRuleModel.create(
            store_id=rule.store_id,
            source_id=rule.source_sku,
            target_id=rule.target_sku,
            action=rule.action,
            weight=rule.weight,
            note=rule.note,
        )
        return self._to_entity(model)

    async def delete(self, rule_id: int) -> bool:
        deleted = await RecommendationRuleModel.filter(id=rule_id).delete()
        return deleted > 0

    async def get_weights(self, store_id: int) -> BlendWeights:
        model = await BlendWeightsModel.filter(store_id=store_id).first()
        if model is None:
            return BlendWeights(store_id=store_id, **DEFAULT_BLEND_WEIGHTS)
        return BlendWeights(
            store_id=store_id,
            w_cooccurrence=model.w_cooccurrence,
            w_content=model.w_content,
            w_popularity=model.w_popularity,
        )

    async def set_weights(self, store_id: int, weights: BlendWeights) -> BlendWeights:
        await BlendWeightsModel.update_or_create(
            store_id=store_id,
            defaults={
                "w_cooccurrence": weights.w_cooccurrence,
                "w_content": weights.w_content,
                "w_popularity": weights.w_popularity,
            },
        )
        return BlendWeights(store_id=store_id, **weights.model_dump(exclude={"store_id"}))

    @staticmethod
    def _to_entity(model) -> RecommendationRule:
        return RecommendationRule(
            id=model.id,
            store_id=model.store_id,
            source_sku=model.source_id,
            target_sku=model.target_id,
            action=model.action,
            weight=model.weight,
            note=model.note,
        )
