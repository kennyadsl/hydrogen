import {useLoaderData} from '@remix-run/react';
import {Money, Pagination, getPaginationVariables} from '@shopify/hydrogen';
import {
  json,
  redirect,
  type LoaderArgs,
  type V2_MetaFunction,
} from '@shopify/remix-oxygen';
import {LocalizedLink} from '~/components/LocalizedLink';
import type {
  CustomerOrdersFragment,
  OrderItemFragment,
} from 'storefrontapi.generated';
import {localizePath} from '~/utils';
import {useTranslation} from 'react-i18next';

export const meta: V2_MetaFunction = () => {
  return [{title: 'Orders'}];
};

export async function loader({request, context}: LoaderArgs) {
  const {session, storefront} = context;

  const customerAccessToken = await session.get('customerAccessToken');
  if (!customerAccessToken?.accessToken) {
    return redirect(localizePath('/account/login', context.i18n));
  }

  try {
    const paginationVariables = getPaginationVariables(request, {
      pageBy: 20,
    });

    const {customer} = await storefront.query(CUSTOMER_ORDERS_QUERY, {
      variables: {
        customerAccessToken: customerAccessToken.accessToken,
        country: storefront.i18n.country,
        language: storefront.i18n.language,
        ...paginationVariables,
      },
      cache: storefront.CacheNone(),
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return json({customer});
  } catch (error: unknown) {
    if (error instanceof Error) {
      return json({error: error.message}, {status: 400});
    }
    return json({error}, {status: 400});
  }
}

export default function Orders() {
  const {customer} = useLoaderData<{customer: CustomerOrdersFragment}>();
  const {orders, numberOfOrders} = customer;
  const {t} = useTranslation();
  return (
    <div className="orders">
      <h2>
        {t('account.home.menu.orders')} <small>({numberOfOrders})</small>
      </h2>
      <br />
      {orders.nodes.length ? <OrdersTable orders={orders} /> : <EmptyOrders />}
    </div>
  );
}

function OrdersTable({orders}: Pick<CustomerOrdersFragment, 'orders'>) {
  const {t} = useTranslation();
  return (
    <div className="acccount-orders">
      {orders?.nodes.length ? (
        <Pagination connection={orders}>
          {({nodes, isLoading, PreviousLink, NextLink}) => {
            return (
              <>
                <PreviousLink>
                  {isLoading ? (
                    <span>{t('layout.pagination.loading')}</span>
                  ) : (
                    <span>{t('layout.pagination.previous')}</span>
                  )}
                </PreviousLink>
                {nodes.map((order) => {
                  return <OrderItem key={order.id} order={order} />;
                })}
                <NextLink>
                  {isLoading ? (
                    <span>{t('layout.pagination.loading')}</span>
                  ) : (
                    <span>{t('layout.pagination.next')}</span>
                  )}
                </NextLink>
              </>
            );
          }}
        </Pagination>
      ) : (
        <EmptyOrders />
      )}
    </div>
  );
}

function EmptyOrders() {
  return (
    <div>
      <p>You haven&apos;t placed any orders yet.</p>
      <br />
      <p>
        <LocalizedLink to="/collections">Start Shopping →</LocalizedLink>
      </p>
    </div>
  );
}

function OrderItem({order}: {order: OrderItemFragment}) {
  return (
    <>
      <fieldset>
        <LocalizedLink to={`/account/orders/${order.id}`}>
          <strong>#{order.orderNumber}</strong>
        </LocalizedLink>
        <p>{new Date(order.processedAt).toDateString()}</p>
        <p>{order.financialStatus}</p>
        <p>{order.fulfillmentStatus}</p>
        <Money data={order.currentTotalPrice} />
        <LocalizedLink to={`/account/orders/${btoa(order.id)}`}>
          View Order →
        </LocalizedLink>
      </fieldset>
      <br />
    </>
  );
}

const ORDER_ITEM_FRAGMENT = `#graphql
  fragment OrderItem on Order {
    currentTotalPrice {
      amount
      currencyCode
    }
    financialStatus
    fulfillmentStatus
    id
    lineItems(first: 10) {
      nodes {
        title
        variant {
          image {
            url
            altText
            height
            width
          }
        }
      }
    }
    orderNumber
    customerUrl
    statusUrl
    processedAt
  }
` as const;

export const CUSTOMER_FRAGMENT = `#graphql
  fragment CustomerOrders on Customer {
    numberOfOrders
    orders(
      sortKey: PROCESSED_AT,
      reverse: true,
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor
    ) {
      nodes {
        ...OrderItem
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        hasNextPage
        endCursor
      }
    }
  }
  ${ORDER_ITEM_FRAGMENT}
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/customer
const CUSTOMER_ORDERS_QUERY = `#graphql
  ${CUSTOMER_FRAGMENT}
  query CustomerOrders(
    $country: CountryCode
    $customerAccessToken: String!
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $startCursor: String
  ) @inContext(country: $country, language: $language) {
    customer(customerAccessToken: $customerAccessToken) {
      ...CustomerOrders
    }
  }
` as const;
