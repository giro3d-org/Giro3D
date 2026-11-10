#if defined(VIEWSHED_CUBEMAP)
applyCubeViewshed(origin, viewshed_vVisWorld);
#endif

#if defined(VIEWSHED_FRUSTUM)
applyFrustumViewshed(origin, viewshed_vVisWorld);
#endif
