// hooks/useUrlSync.js
import {useEffect} from 'react';
import {useSearchParams} from 'react-router-dom';

const useUrlSync = ({
                        page,
                        setPage,
                        search,
                        setSearch,
                        sortField,
                        sortOrder,
                        setSortField,
                        setSortOrder,
                        defaultSort = 'modified_on:desc'
                    }) => {
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const urlPage = parseInt(searchParams.get('page')) || 1;
        const urlSearch = searchParams.get('search') || '';
        const sortParam = searchParams.get('sort') || defaultSort;
        const [urlSortField, urlSortOrder] = sortParam.split(':');

        setPage(urlPage);
        setSearch(urlSearch);
        setSortField(urlSortField || '');
        setSortOrder(urlSortOrder || '');
    }, []);

    useEffect(() => {
        const sort = sortField && sortOrder ? `${sortField}:${sortOrder}` : '';
        setSearchParams({
            page: page.toString(),
            search,
            sort,
        });
    }, [page, search, sortField, sortOrder]);
};

export default useUrlSync;